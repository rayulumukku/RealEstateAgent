import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/super-builder/projects — get super builder's projects
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

  const { data: projects, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("developer_id", session.sub)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ projects: projects || [] });
}
