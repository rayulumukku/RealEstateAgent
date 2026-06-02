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

  // Builder sees their own followers
  if (session.role === "builder" || session.role === "super_builder") {
    const { data: followers } = await supabaseAdmin.from("agent_follows_builder").select("*, profiles!agent_follows_builder_agent_id_fkey(name, phone, agency_name, location)").eq("builder_id", session.sub).order("created_at", { ascending: false });
    return NextResponse.json({ followers: followers || [] });
  }

  // Agent gets their following list
  if (session.role === "agent") {
    const { data: following } = await supabaseAdmin.from("agent_follows_builder").select("builder_id").eq("agent_id", session.sub);
    return NextResponse.json({ following: (following || []).map((f: any) => f.builder_id) });
  }

  return NextResponse.json({ followers: [] });
}
