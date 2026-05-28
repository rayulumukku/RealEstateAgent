import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// POST /api/inquiries — client submits a question, gets connected to an agent
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { client_name, client_phone, project_id, question } = body;

    if (!client_name || !client_phone || !question) {
      return NextResponse.json(
        { ok: false, error: "Name, phone, and question are required." },
        { status: 400 }
      );
    }

    // Auto-assign to an approved agent (round-robin: pick agent with fewest inquiries)
    const { data: agents } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role", "agent")
      .eq("status", "approved")
      .limit(10);

    let assignedAgentId: string | null = null;

    if (agents && agents.length > 0) {
      // Simple: assign to first available agent
      // In production, implement round-robin or load balancing
      assignedAgentId = agents[0].id;
    }

    const { data: inquiry, error } = await supabaseAdmin
      .from("client_inquiries")
      .insert([{
        client_name,
        client_phone,
        project_id: project_id || null,
        question,
        assigned_agent_id: assignedAgentId,
        status: assignedAgentId ? "assigned" : "open",
      }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: assignedAgentId
        ? "Your question has been assigned to an agent. They will contact you shortly."
        : "Your question has been received. An agent will be assigned soon.",
      inquiry_id: inquiry.id,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

// GET /api/inquiries?agent_phone=... — agent sees their assigned inquiries
export async function GET(req: NextRequest) {
  const agentPhone = req.nextUrl.searchParams.get("agent_phone");
  if (!agentPhone) {
    return NextResponse.json({ ok: false, error: "agent_phone required" }, { status: 400 });
  }

  const digits = agentPhone.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  const formattedPhone = `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("phone", formattedPhone)
    .single();

  if (!profile) {
    return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 404 });
  }

  const { data: inquiries } = await supabaseAdmin
    .from("client_inquiries")
    .select("*")
    .eq("assigned_agent_id", profile.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ ok: true, inquiries: inquiries || [] });
}
