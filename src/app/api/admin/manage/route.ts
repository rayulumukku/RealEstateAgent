import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ADMIN_ROLES = ["admin", "verification", "operations", "super_admin"];

// Helper to verify admin access (includes super_admin)
async function verifyAdmin() {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session || !ADMIN_ROLES.includes(session.role)) {
    return null;
  }
  return session;
}

// PUT /api/admin/manage — edit a project or event
export async function PUT(req: NextRequest) {
  const session = await verifyAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { type, id, updates } = body;

    if (!type || !id || !updates) {
      return NextResponse.json({ error: "type, id, and updates are required." }, { status: 400 });
    }

    if (type === "project") {
      const allowedFields: Record<string, any> = {};
      if (updates.name !== undefined) allowedFields.name = updates.name;
      if (updates.location !== undefined) allowedFields.location = updates.location;
      if (updates.city !== undefined) allowedFields.city = updates.city;
      if (updates.price_range !== undefined) allowedFields.price_range = updates.price_range;
      if (updates.type !== undefined) allowedFields.type = updates.type;

      if (Object.keys(allowedFields).length === 0) {
        return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from("projects")
        .update(allowedFields)
        .eq("id", id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, message: "Project updated." });
    }

    if (type === "event") {
      const allowedFields: Record<string, any> = {};
      if (updates.title !== undefined) allowedFields.title = updates.title;
      if (updates.date !== undefined) allowedFields.date = updates.date;
      if (updates.location !== undefined) allowedFields.location = updates.location;
      if (updates.description !== undefined) allowedFields.description = updates.description;

      if (Object.keys(allowedFields).length === 0) {
        return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from("events")
        .update(allowedFields)
        .eq("id", id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, message: "Event updated." });
    }

    if (type === "super_builder_event") {
      const allowedFields: Record<string, any> = {};
      if (updates.title !== undefined) allowedFields.title = updates.title;
      if (updates.date !== undefined) allowedFields.date = updates.date;
      if (updates.location !== undefined) allowedFields.location = updates.location;
      if (updates.description !== undefined) allowedFields.description = updates.description;
      if (updates.target_audience !== undefined) allowedFields.target_audience = updates.target_audience;

      if (Object.keys(allowedFields).length === 0) {
        return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from("super_builder_events")
        .update(allowedFields)
        .eq("id", id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, message: "Super Builder event updated." });
    }

    return NextResponse.json({ error: "Invalid type. Must be 'project', 'event', or 'super_builder_event'." }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/manage — delete a project or event
export async function DELETE(req: NextRequest) {
  const session = await verifyAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { type, id } = body;

    if (!type || !id) {
      return NextResponse.json({ error: "type and id are required." }, { status: 400 });
    }

    if (type === "project") {
      // Also clean up related shares
      await supabaseAdmin.from("project_shares").delete().eq("project_id", id);
      const { error } = await supabaseAdmin.from("projects").delete().eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, message: "Project deleted." });
    }

    if (type === "event") {
      // Also clean up RSVPs
      await supabaseAdmin.from("rsvps").delete().eq("event_id", id);
      const { error } = await supabaseAdmin.from("events").delete().eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, message: "Event deleted." });
    }

    if (type === "super_builder_event") {
      const { error } = await supabaseAdmin.from("super_builder_events").delete().eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, message: "Super Builder event deleted." });
    }

    return NextResponse.json({ error: "Invalid type." }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/admin/manage — recreate (create new) project or event on behalf of a builder/super_builder
export async function POST(req: NextRequest) {
  const session = await verifyAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { type, data: createData } = body;

    if (!type || !createData) {
      return NextResponse.json({ error: "type and data are required." }, { status: 400 });
    }

    if (type === "project") {
      const { developer_id, name, location, city, price_range, type: projectType } = createData;
      if (!developer_id || !name) {
        return NextResponse.json({ error: "developer_id and name are required." }, { status: 400 });
      }

      const { data: project, error } = await supabaseAdmin
        .from("projects")
        .insert([{
          developer_id,
          name,
          location: location || "",
          city: city || "",
          price_range: price_range || "",
          type: projectType || "Residential",
        }])
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, project, message: "Project created." });
    }

    if (type === "event") {
      const { title, date, location, description, builder_id } = createData;
      if (!title || !date || !location) {
        return NextResponse.json({ error: "title, date, and location are required." }, { status: 400 });
      }

      const { data: event, error } = await supabaseAdmin
        .from("events")
        .insert([{
          title,
          date,
          location,
          description: description || null,
          event_type: "admin_created",
        }])
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Optionally create a campaign record if builder_id is provided
      if (builder_id) {
        await supabaseAdmin.from("campaigns").insert([{
          builder_id,
          name: title,
          audience_segment: "Admin created",
          template: "Admin",
          sent_count: 0,
          read_rate: 0,
        }]);
      }

      return NextResponse.json({ ok: true, event, message: "Event created." });
    }

    if (type === "super_builder_event") {
      const { created_by, title, date, location, description, target_audience } = createData;
      if (!created_by || !title || !date || !location) {
        return NextResponse.json({ error: "created_by, title, date, and location are required." }, { status: 400 });
      }

      const { data: event, error } = await supabaseAdmin
        .from("super_builder_events")
        .insert([{
          created_by,
          title,
          date,
          location,
          description: description || null,
          target_audience: target_audience || "both",
          target_locations: [],
        }])
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, event, message: "Super Builder event created." });
    }

    return NextResponse.json({ error: "Invalid type." }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
