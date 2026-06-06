import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/profile — returns the full profile for the authenticated user.
export async function GET() {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ profile: null, error: "Not authenticated" }, { status: 401 });
  }

  // Try by ID first
  let { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", session.sub)
    .maybeSingle();

  // If not found by ID, try by phone (handles case where session.sub doesn't match profile.id)
  if (!profile && session.phone) {
    const { data: profileByPhone } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("phone", session.phone)
      .maybeSingle();

    if (profileByPhone) {
      profile = profileByPhone;
      error = null;
    }
  }

  if (error) {
    return NextResponse.json({ profile: null, error: error.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ profile: null, error: "Could not load profile." }, { status: 404 });
  }

  // Resolve parent Super Builder credits if sub-builder
  if (profile.parent_id) {
    const { data: parentProfile } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("id", profile.parent_id)
      .maybeSingle();

    if (parentProfile) {
      profile.credits = parentProfile.credits;
    }
  }

  return NextResponse.json({ profile });
}

// PUT /api/profile — update the authenticated user's profile.
export async function PUT(req: Request) {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Only allow updating safe fields
    const updates: Record<string, any> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.agency_name !== undefined) updates.agency_name = body.agency_name;
    if (body.email !== undefined) updates.email = body.email;
    if (body.rera_number !== undefined) updates.rera_number = body.rera_number;
    if (body.location !== undefined) updates.location = body.location;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", session.sub)
      .select()
      .maybeSingle();

    // If update by ID didn't find the row, try by phone
    if (!profile && session.phone) {
      const { data: profileByPhone, error: phoneErr } = await supabaseAdmin
        .from("profiles")
        .update(updates)
        .eq("phone", session.phone)
        .select()
        .maybeSingle();

      if (profileByPhone) {
        return NextResponse.json({ profile: profileByPhone });
      }
      if (phoneErr) {
        return NextResponse.json({ error: phoneErr.message }, { status: 500 });
      }
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
