import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/leads — returns leads for the authenticated agent.
// Admin/verification/operations roles get ALL leads across the platform.
export async function GET() {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ leads: [], error: "Not authenticated" }, { status: 401 });
  }

  try {
    if (session.role === "admin" || session.role === "verification" || session.role === "operations") {
      // Admin sees ALL leads with agent name
      const { data: leads, error } = await supabaseAdmin
        .from("leads")
        .select("*, profiles!leads_agent_id_fkey(name, phone, agency_name)")
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json({ leads: [], error: error.message }, { status: 500 });
      }

      const mapped = (leads || []).map((l: any) => ({
        ...l,
        agent_name: l.profiles?.name || "Unknown",
        agent_phone: l.profiles?.phone || "",
        agent_agency: l.profiles?.agency_name || "",
      }));

      return NextResponse.json({ leads: mapped });
    }

    // Agent/Builder: only their own leads
    const { data: leads, error } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("agent_id", session.sub)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ leads: [], error: error.message }, { status: 500 });
    }

    return NextResponse.json({ leads: leads || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ leads: [], error: msg }, { status: 500 });
  }
}

// POST /api/leads — add a new lead for the authenticated agent.
export async function POST(req: Request) {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const { data: newLead, error } = await supabaseAdmin
      .from("leads")
      .insert([{
        agent_id: session.sub,
        name: body.name,
        phone: body.phone || "",
        requirement: body.requirement || "3 BHK",
        location: body.location || "",
        budget: body.budget || "",
        status: "new",
        details: body.details || {},
      }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ lead: newLead });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
