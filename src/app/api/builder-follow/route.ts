import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// POST /api/builder-follow — follow or unfollow a super builder
export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.role !== "builder") {
    return NextResponse.json({ error: "Only builders can follow/unfollow super builders." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { super_builder_id, action } = body;

    if (!super_builder_id) {
      return NextResponse.json({ error: "super_builder_id is required." }, { status: 400 });
    }

    if (action !== "follow" && action !== "unfollow") {
      return NextResponse.json({ error: "action must be 'follow' or 'unfollow'." }, { status: 400 });
    }

    // Verify the target is actually a super_builder
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id, role, name")
      .eq("id", super_builder_id)
      .eq("role", "super_builder")
      .maybeSingle();

    if (!target) {
      return NextResponse.json({ error: "Super builder not found." }, { status: 404 });
    }

    // Get the builder's profile for notification purposes
    const { data: builderProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, name, phone, agency_name")
      .eq("id", session.sub)
      .maybeSingle();

    if (action === "follow") {
      // Insert follow record (upsert to avoid duplicates)
      const { error: insertError } = await supabaseAdmin
        .from("builder_follows")
        .upsert(
          { follower_id: session.sub, followed_id: super_builder_id },
          { onConflict: "follower_id,followed_id" }
        );

      if (insertError) {
        console.error("Follow insert error:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      // Create a notification for the super builder
      await supabaseAdmin.from("follow_notifications").insert([
        {
          super_builder_id,
          builder_id: session.sub,
          builder_name: builderProfile?.name || "Unknown Builder",
          builder_phone: builderProfile?.phone || "",
          builder_company: builderProfile?.agency_name || "",
          action: "followed",
        },
      ]);

      return NextResponse.json({ ok: true, message: "Successfully followed.", action: "follow" });
    } else {
      // Unfollow: delete the follow record
      const { error: deleteError } = await supabaseAdmin
        .from("builder_follows")
        .delete()
        .eq("follower_id", session.sub)
        .eq("followed_id", super_builder_id);

      if (deleteError) {
        console.error("Unfollow delete error:", deleteError);
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      // Create a notification for the super builder about the unfollow
      await supabaseAdmin.from("follow_notifications").insert([
        {
          super_builder_id,
          builder_id: session.sub,
          builder_name: builderProfile?.name || "Unknown Builder",
          builder_phone: builderProfile?.phone || "",
          builder_company: builderProfile?.agency_name || "",
          action: "unfollowed",
        },
      ]);

      return NextResponse.json({ ok: true, message: "Successfully unfollowed.", action: "unfollow" });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("builder-follow POST error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET /api/builder-follow — get follower count for a super builder or check follow status
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const superBuilderId = searchParams.get("super_builder_id");

  if (superBuilderId) {
    // Get follower count for a specific super builder
    const { count } = await supabaseAdmin
      .from("builder_follows")
      .select("id", { count: "exact", head: true })
      .eq("followed_id", superBuilderId);

    // Check if current user follows them
    let isFollowing = false;
    if (session.role === "builder") {
      const { data: follow } = await supabaseAdmin
        .from("builder_follows")
        .select("id")
        .eq("follower_id", session.sub)
        .eq("followed_id", superBuilderId)
        .maybeSingle();
      isFollowing = !!follow;
    }

    return NextResponse.json({ followerCount: count || 0, isFollowing });
  }

  // If super_builder, get total followers
  if (session.role === "super_builder") {
    const { count } = await supabaseAdmin
      .from("builder_follows")
      .select("id", { count: "exact", head: true })
      .eq("followed_id", session.sub);

    return NextResponse.json({ followerCount: count || 0 });
  }

  return NextResponse.json({ error: "Missing super_builder_id parameter." }, { status: 400 });
}
