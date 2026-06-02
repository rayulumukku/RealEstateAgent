import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function verifySuperAdmin() {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);
  if (!session || session.role !== "super_admin") return null;
  return session;
}

// PUT /api/super-admin/users — suspend or reactivate a user
export async function PUT(req: NextRequest) {
  const session = await verifySuperAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized. Super Admin only." }, { status: 403 });

  try {
    const { user_id, action } = await req.json();
    if (!user_id || !action) return NextResponse.json({ error: "user_id and action required." }, { status: 400 });

    // Prevent self-suspension
    if (user_id === session.sub) return NextResponse.json({ error: "Cannot modify your own account." }, { status: 400 });

    if (action === "suspend") {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ status: "suspended" })
        .eq("id", user_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, message: "User suspended." });
    }

    if (action === "reactivate") {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ status: "approved" })
        .eq("id", user_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, message: "User reactivated." });
    }

    return NextResponse.json({ error: "Invalid action. Use 'suspend' or 'reactivate'." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

// DELETE /api/super-admin/users — permanently delete a user
export async function DELETE(req: NextRequest) {
  const session = await verifySuperAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized. Super Admin only." }, { status: 403 });

  try {
    const { user_id } = await req.json();
    if (!user_id) return NextResponse.json({ error: "user_id required." }, { status: 400 });

    // Prevent self-deletion
    if (user_id === session.sub) return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });

    // Delete related data first
    await supabaseAdmin.from("leads").delete().eq("agent_id", user_id);
    await supabaseAdmin.from("reminders").delete().eq("agent_id", user_id);
    await supabaseAdmin.from("project_shares").delete().eq("builder_id", user_id);
    await supabaseAdmin.from("project_shares").delete().eq("shared_by", user_id);
    await supabaseAdmin.from("builder_follows").delete().eq("follower_id", user_id);
    await supabaseAdmin.from("builder_follows").delete().eq("followed_id", user_id);
    await supabaseAdmin.from("follow_notifications").delete().eq("builder_id", user_id);
    await supabaseAdmin.from("follow_notifications").delete().eq("super_builder_id", user_id);
    await supabaseAdmin.from("projects").delete().eq("developer_id", user_id);
    await supabaseAdmin.from("campaigns").delete().eq("builder_id", user_id);
    await supabaseAdmin.from("super_builder_events").delete().eq("created_by", user_id);
    await supabaseAdmin.from("rsvps").delete().eq("agent_id", user_id);
    await supabaseAdmin.from("referrals").delete().eq("referrer_id", user_id);

    // Finally delete the profile
    const { error } = await supabaseAdmin.from("profiles").delete().eq("id", user_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, message: "User permanently deleted." });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
