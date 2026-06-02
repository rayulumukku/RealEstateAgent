import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/super-builder/notifications — get notifications for this super builder
export async function GET() {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.role !== "super_builder") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const { data: notifications, error } = await supabaseAdmin
    .from("follow_notifications")
    .select("*")
    .eq("super_builder_id", session.sub)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get unread count
  const { count: unreadCount } = await supabaseAdmin
    .from("follow_notifications")
    .select("id", { count: "exact", head: true })
    .eq("super_builder_id", session.sub)
    .eq("is_read", false);

  return NextResponse.json({
    notifications: notifications || [],
    unreadCount: unreadCount || 0,
  });
}

// PUT /api/super-builder/notifications — mark notifications as read
export async function PUT(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.role !== "super_builder") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (body.action === "mark_all_read") {
      const { error } = await supabaseAdmin
        .from("follow_notifications")
        .update({ is_read: true })
        .eq("super_builder_id", session.sub)
        .eq("is_read", false);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, message: "All notifications marked as read." });
    }

    if (body.notification_id) {
      const { error } = await supabaseAdmin
        .from("follow_notifications")
        .update({ is_read: true })
        .eq("id", body.notification_id)
        .eq("super_builder_id", session.sub);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
