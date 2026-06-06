import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// POST /api/agent-follow — agent follows or unfollows a builder
export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "agent") return NextResponse.json({ error: "Only agents can follow/unfollow builders." }, { status: 403 });

  try {
    const body = await req.json();
    const { builder_id, action } = body;

    if (!builder_id) return NextResponse.json({ error: "builder_id is required." }, { status: 400 });
    if (action !== "follow" && action !== "unfollow") return NextResponse.json({ error: "action must be 'follow' or 'unfollow'." }, { status: 400 });

    const { data: target } = await supabaseAdmin.from("profiles").select("id, role").eq("id", builder_id).in("role", ["builder", "super_builder"]).maybeSingle();
    if (!target) return NextResponse.json({ error: "Builder not found." }, { status: 404 });

    if (action === "follow") {
      const { error } = await supabaseAdmin.from("agent_follows_builder").upsert({ agent_id: session.sub, builder_id }, { onConflict: "agent_id,builder_id" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, action: "follow" });
    } else {
      const { error } = await supabaseAdmin.from("agent_follows_builder").delete().eq("agent_id", session.sub).eq("builder_id", builder_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, action: "unfollow" });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

// GET /api/agent-follow — get followers or check follow status
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Builder sees their own followers (both direct follows and project follows)
  if (session.role === "builder" || session.role === "super_builder") {
    // Resolve the real builder ID and profile to handle session phone fallback
    let realBuilderId = session.sub;
    let { data: builderProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, parent_id")
      .eq("id", session.sub)
      .maybeSingle();

    if (!builderProfile && session.phone) {
      const { data: profileByPhone } = await supabaseAdmin
        .from("profiles")
        .select("id, parent_id")
        .eq("phone", session.phone)
        .maybeSingle();
      if (profileByPhone) {
        builderProfile = profileByPhone;
        realBuilderId = profileByPhone.id;
      }
    }

    // 1. Fetch direct builder follows safely without constraint joins
    let directFollows: any[] = [];
    try {
      const { data: followsData, error: followError } = await supabaseAdmin
        .from("agent_follows_builder")
        .select("agent_id, created_at")
        .eq("builder_id", realBuilderId);

      if (followError) {
        console.warn("Could not load agent_follows_builder:", followError.message);
      } else if (followsData && followsData.length > 0) {
        const agentIds = followsData.map((d: any) => d.agent_id);
        const { data: agentProfiles } = await supabaseAdmin
          .from("profiles")
          .select("id, name, phone, agency_name, location")
          .in("id", agentIds);

        if (agentProfiles) {
          directFollows = followsData.map((d: any) => ({
            agent_id: d.agent_id,
            created_at: d.created_at,
            profiles: agentProfiles.find((p: any) => p.id === d.agent_id) || null
          })).filter((d: any) => d.profiles !== null);
        }
      }
    } catch (e: any) {
      console.warn("Failed to fetch directFollows safely:", e.message);
    }

    // 2. Fetch builder's projects
    const { data: projects } = await supabaseAdmin
      .from("projects")
      .select("id, name")
      .eq("developer_id", realBuilderId);

    let projectFollows: any[] = [];
    const projectMap = new Map<string, string>();
    if (projects) {
      projects.forEach((p) => projectMap.set(p.id, p.name));
    }

    if (projects && projects.length > 0) {
      const projectIds = projects.map((p) => p.id);
      const { data: rsvps } = await supabaseAdmin
        .from("rsvps")
        .select("agent_id, event_id, created_at, profiles:profiles(name, phone, agency_name, location)")
        .in("event_id", projectIds);
      if (rsvps) {
        projectFollows = rsvps;
      }
    }

    // 3. Merge direct and project follows (de-duplicate on agent_id)
    const mergedMap = new Map<string, { id: string; created_at: string; profiles: any; followedProjects: string[] }>();

    if (directFollows) {
      directFollows.forEach((df: any) => {
        mergedMap.set(df.agent_id, {
          id: df.agent_id,
          created_at: df.created_at,
          profiles: df.profiles || null,
          followedProjects: []
        });
      });
    }

    if (projectFollows) {
      projectFollows.forEach((pf: any) => {
        const projName = projectMap.get(pf.event_id) || "Unknown Project";
        const existing = mergedMap.get(pf.agent_id);
        if (existing) {
          if (!existing.followedProjects.includes(projName)) {
            existing.followedProjects.push(projName);
          }
          if (new Date(pf.created_at).getTime() > new Date(existing.created_at).getTime()) {
            existing.created_at = pf.created_at;
          }
        } else {
          mergedMap.set(pf.agent_id, {
            id: pf.agent_id,
            created_at: pf.created_at,
            profiles: pf.profiles || null,
            followedProjects: [projName]
          });
        }
      });
    }

    const mergedList = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Fetch assigned agents if this builder is a sub-builder
    let assignedList: any[] = [];

    if (builderProfile?.parent_id) {
      const { data: assignments } = await supabaseAdmin
        .from("sub_builder_agent_assignments")
        .select("agent_id, created_at")
        .eq("sub_builder_id", realBuilderId);

      if (assignments && assignments.length > 0) {
        const agentIds = assignments.map((a: any) => a.agent_id);
        const { data: agentProfiles } = await supabaseAdmin
          .from("profiles")
          .select("id, name, phone, agency_name, location")
          .in("id", agentIds);

        if (agentProfiles) {
          assignedList = assignments.map((a: any) => {
            const prof = agentProfiles.find((ap: any) => ap.id === a.agent_id);
            return {
              id: a.agent_id,
              created_at: a.created_at,
              profiles: prof || null
            };
          }).filter((a: any) => a.profiles !== null);
        }
      }
    }

    return NextResponse.json({ followers: mergedList, assignedAgents: assignedList });
  }

  // Agent gets their following list safely
  if (session.role === "agent") {
    let followingList: string[] = [];
    try {
      const { data: following, error } = await supabaseAdmin
        .from("agent_follows_builder")
        .select("builder_id")
        .eq("agent_id", session.sub);
      if (!error && following) {
        followingList = following.map((f: any) => f.builder_id);
      }
    } catch (e: any) {
      console.warn("Failed to fetch following safely:", e.message);
    }
    return NextResponse.json({ following: followingList });
  }

  return NextResponse.json({ followers: [] });
}
