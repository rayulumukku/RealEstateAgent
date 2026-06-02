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

// POST /api/super-admin/warnings — create a new warning for specific roles/users
export async function POST(req: NextRequest) {
  const session = await verifySuperAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized. Super Admin only." }, { status: 403 });

  try {
    const body = await req.json();
    const { message, target_roles, target_user_ids } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Warning message is required." }, { status: 400 });
    }

    if ((!target_roles || target_roles.length === 0) && (!target_user_ids || target_user_ids.length === 0)) {
      return NextResponse.json({ error: "At least one target role or user must be selected." }, { status: 400 });
    }

    const { data: warning, error } = await supabaseAdmin
      .from("warnings")
      .insert([{
        message: message.trim(),
        target_roles: target_roles || [],
        target_user_ids: target_user_ids || [],
        created_by: session.sub,
      }])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, warning });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET /api/super-admin/warnings — list all warnings sent by super admin
export async function GET() {
  const session = await verifySuperAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized. Super Admin only." }, { status: 403 });

  const { data: warnings, error } = await supabaseAdmin
    .from("warnings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get acknowledgment counts per warning
  const warningIds = (warnings || []).map((w: any) => w.id);
  let ackCounts: Record<string, number> = {};

  if (warningIds.length > 0) {
    const { data: acks } = await supabaseAdmin
      .from("warning_acknowledgments")
      .select("warning_id");

    if (acks) {
      for (const ack of acks) {
        ackCounts[ack.warning_id] = (ackCounts[ack.warning_id] || 0) + 1;
      }
    }
  }

  const enriched = (warnings || []).map((w: any) => ({
    ...w,
    ack_count: ackCounts[w.id] || 0,
  }));

  return NextResponse.json({ warnings: enriched });
}
