import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// POST /api/super-builder/events — create an event targeting builders, agents, or both
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
    const { title, date, location, description, target_audience, target_locations } = body;

    if (!title || !date || !location) {
      return NextResponse.json({ error: "Title, date, and location are required." }, { status: 400 });
    }

    if (!["builders", "agents", "both"].includes(target_audience)) {
      return NextResponse.json({ error: "target_audience must be 'builders', 'agents', or 'both'." }, { status: 400 });
    }

    // Insert into super_builder_events table
    const { data: event, error: insertError } = await supabaseAdmin
      .from("super_builder_events")
      .insert([{
        created_by: session.sub,
        title,
        date,
        location,
        description: description || null,
        target_audience,
        target_locations: target_locations || [],
      }])
      .select()
      .single();

    if (insertError) {
      console.error("Event insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Also insert into the general events table so it appears in agent/builder feeds
    await supabaseAdmin.from("events").insert([{
      title,
      date,
      location,
      description: description || null,
      event_type: "super_builder_event",
      target_locations: target_locations || [],
    }]);

    // Send WhatsApp notifications if GallaBox is configured
    const apiKey = process.env.GALLABOX_API_KEY;
    const apiSecret = process.env.GALLABOX_API_SECRET;
    const channelId = process.env.GALLABOX_CHANNEL_ID;

    if (apiKey && apiSecret && channelId) {
      let recipients: { phone: string; name: string }[] = [];

      // Get builders if targeting builders or both
      if (target_audience === "builders" || target_audience === "both") {
        const { data: builders } = await supabaseAdmin
          .from("profiles")
          .select("phone, name")
          .eq("role", "builder")
          .eq("status", "approved");
        if (builders) recipients.push(...builders);
      }

      // Get agents if targeting agents or both
      if (target_audience === "agents" || target_audience === "both") {
        let agentQuery = supabaseAdmin
          .from("profiles")
          .select("phone, name")
          .eq("role", "agent")
          .eq("status", "approved");

        if (target_locations && target_locations.length > 0) {
          agentQuery = agentQuery.in("location", target_locations);
        }

        const { data: agents } = await agentQuery;
        if (agents) recipients.push(...agents);
      }

      // Send WhatsApp to all recipients
      for (const recipient of recipients) {
        if (!recipient.phone) continue;
        const cleanPhone = recipient.phone.replace(/\D/g, "");
        const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

        await fetch("https://server.gallabox.com/devapi/messages/whatsapp", {
          method: "POST",
          headers: {
            "apiKey": apiKey,
            "apiSecret": apiSecret,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channelId,
            channelType: "whatsapp",
            recipient: { name: recipient.name || "Partner", phone: finalPhone },
            whatsapp: {
              type: "text",
              text: {
                body: `*${title}*\n\n${description || "You're invited!"}\n\nDate: ${date}\nLocation: ${location}`,
              },
            },
          }),
        }).catch((err) => console.error("GallaBox send error:", err));
      }
    }

    return NextResponse.json({ event, ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("super-builder/events POST error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET /api/super-builder/events — get all events created by this super builder
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

  const { data: events, error } = await supabaseAdmin
    .from("super_builder_events")
    .select("*")
    .eq("created_by", session.sub)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: events || [] });
}
