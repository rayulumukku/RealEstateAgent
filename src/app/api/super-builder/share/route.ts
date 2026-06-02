import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// POST /api/super-builder/share — share a project with selected builders
export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.role !== "super_builder") {
    return NextResponse.json({ error: "Unauthorized. Super Builder access required." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { project_id, builder_ids } = body;

    if (!project_id) {
      return NextResponse.json({ error: "project_id is required." }, { status: 400 });
    }

    if (!builder_ids || !Array.isArray(builder_ids) || builder_ids.length === 0) {
      return NextResponse.json({ error: "At least one builder_id is required." }, { status: 400 });
    }

    // Verify the project belongs to this super builder
    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("id", project_id)
      .eq("developer_id", session.sub)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Project not found or you don't own it." }, { status: 404 });
    }

    // Insert share records (upsert to avoid duplicates)
    const shareRecords = builder_ids.map((builder_id: string) => ({
      project_id,
      builder_id,
      shared_by: session.sub,
      status: "active",
    }));

    const { data: shares, error: insertError } = await supabaseAdmin
      .from("project_shares")
      .upsert(shareRecords, {
        onConflict: "project_id,builder_id",
        ignoreDuplicates: false,
      })
      .select();

    if (insertError) {
      console.error("Share insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ shares, count: shares?.length || 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("super-builder/share POST error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET /api/super-builder/share — get all shares for this super builder
export async function GET() {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.role !== "super_builder") {
    return NextResponse.json({ error: "Unauthorized. Super Builder access required." }, { status: 403 });
  }

  const { data: shares, error } = await supabaseAdmin
    .from("project_shares")
    .select("*, projects(name, city, location), profiles!project_shares_builder_id_fkey(name, phone, agency_name)")
    .eq("shared_by", session.sub)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ shares: shares || [] });
}

// DELETE /api/super-builder/share — remove a builder from a shared project
export async function DELETE(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.role !== "super_builder") {
    return NextResponse.json({ error: "Unauthorized. Super Builder access required." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { share_id } = body;

    if (!share_id) {
      return NextResponse.json({ error: "share_id is required." }, { status: 400 });
    }

    // Verify the share belongs to this super builder
    const { data: share } = await supabaseAdmin
      .from("project_shares")
      .select("id")
      .eq("id", share_id)
      .eq("shared_by", session.sub)
      .maybeSingle();

    if (!share) {
      return NextResponse.json({ error: "Share record not found or you don't own it." }, { status: 404 });
    }

    // Update status to revoked instead of hard delete
    const { error: updateError } = await supabaseAdmin
      .from("project_shares")
      .update({ status: "revoked" })
      .eq("id", share_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Builder access revoked." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("super-builder/share DELETE error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
