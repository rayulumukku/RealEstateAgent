import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/warnings — get unacknowledged warnings for the current user
export async function GET() {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ warnings: [] });
  }

  // Get all warnings that target this user's role OR this user specifically
  const { data: allWarnings, error } = await supabaseAdmin
    .from("warnings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !allWarnings) {
    return NextResponse.json({ warnings: [] });
  }

  // Filter warnings that apply to this user
  const applicableWarnings = allWarnings.filter((w: any) => {
    const targetRoles: string[] = w.target_roles || [];
    const targetUserIds: string[] = w.target_user_ids || [];

    // Check if user's role is in target_roles
    const roleMatch = targetRoles.includes(session.role);

    // Check if user's ID is in target_user_ids
    const userMatch = targetUserIds.includes(session.sub);

    return roleMatch || userMatch;
  });

  if (applicableWarnings.length === 0) {
    return NextResponse.json({ warnings: [] });
  }

  // Get this user's acknowledgments
  const warningIds = applicableWarnings.map((w: any) => w.id);
  const { data: acks } = await supabaseAdmin
    .from("warning_acknowledgments")
    .select("warning_id")
    .eq("user_id", session.sub)
    .in("warning_id", warningIds);

  const acknowledgedIds = new Set((acks || []).map((a: any) => a.warning_id));

  // Return only unacknowledged warnings
  const unacknowledged = applicableWarnings.filter((w: any) => !acknowledgedIds.has(w.id));

  return NextResponse.json({ warnings: unacknowledged });
}

// POST /api/warnings — acknowledge a warning
export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { warning_id } = body;

    if (!warning_id) {
      return NextResponse.json({ error: "warning_id is required." }, { status: 400 });
    }

    // Upsert acknowledgment (idempotent)
    const { error } = await supabaseAdmin
      .from("warning_acknowledgments")
      .upsert(
        { warning_id, user_id: session.sub },
        { onConflict: "warning_id,user_id" }
      );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
