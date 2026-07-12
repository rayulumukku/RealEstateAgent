import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

function formatPhone(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  if (last10.length !== 10) return raw; // Fallback
  return `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;
}

export async function POST(req: Request) {
  try {
    const { builderPhone, agentIds, messageTemplate } = await req.json();

    if (!builderPhone) {
      return NextResponse.json({ success: false, error: "Missing builder phone" });
    }

    if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      return NextResponse.json({ success: false, error: "No agents selected" });
    }

    // Lookup builder
    const { data: builder, error: builderErr } = await supabase
      .from("profiles")
      .select("id, name, agency_name")
      .eq("phone", builderPhone)
      .single();

    if (builderErr || !builder) {
      return NextResponse.json({ success: false, error: "Builder not found" });
    }

    // Fetch the specific selected agents
    const { data: agents, error: agentsErr } = await supabase
      .from("profiles")
      .select("id, phone, name")
      .in("id", agentIds);

    if (agentsErr || !agents) {
      return NextResponse.json({ success: false, error: "Failed to fetch agents" });
    }

    if (agents.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // Bulk insert invitations in `channel_partners`
    const insertPayload = agents.map(agent => ({
      builder_id: builder.id,
      agent_id: agent.id,
      status: "invited"
    }));

    // We use upsert so we don't fail if they were already invited/connected before
    // though in real life we might want to check existing status first.
    // Assuming status transitions are handled.
    const { error: insertErr } = await supabase
      .from("channel_partners")
      .upsert(insertPayload, { onConflict: "builder_id,agent_id" });

    if (insertErr) {
      console.error("Failed to insert channel partners", insertErr);
      return NextResponse.json({ success: false, error: "Failed to insert channel partners: " + insertErr.message });
    }

    // Send WhatsApp messages (Simulated via webhook endpoint if using sandbox)
    // Or normally we'd hit GallaBox / Meta API here.
    const builderName = builder.agency_name || builder.name || "A Premium Builder";
    
    for (const agent of agents) {
      if (!agent.phone) continue;
      
      const customMessage = messageTemplate ? messageTemplate.replace("[Builder Name]", builderName).replace("[Agent Name]", agent.name) : `*${builderName}* is inviting you to become an official Channel Partner!`;
      
      const message = `Hi ${agent.name},\n\n${customMessage}\n\nReply *Yes* to accept and earn 100 bonus credits, or *No* to decline.`;
      
      // Simulate sending via our local webhook or GallaBox logic
      // In a real app we'd call the Meta Graph API here.
      // We will assume that if we are using the sandbox, they will see it.
      
      const formattedPhone = formatPhone(agent.phone);
      
      // We can insert the outbound message into `whatsapp_messages` directly for the simulator to pick it up.
      const { error: waErr } = await supabase.from("whatsapp_messages").insert([{
        direction: "outbound",
        phone: formattedPhone,
        message_type: "text",
        content: message,
        outbound_status: 1
      }]);
      
      if (waErr) {
        console.error("Failed to insert whatsapp message", waErr);
        return NextResponse.json({ success: false, error: "Failed to send message: " + waErr.message });
      }
    }

    return NextResponse.json({ success: true, count: agents.length });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
