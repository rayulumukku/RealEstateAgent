"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function getCampaignsAction() {
  try {
    const { data: campaigns, error } = await supabaseAdmin
      .from("campaigns")
      .select("*, builder:profiles!builder_id(name, agency_name)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { ok: true, campaigns: campaigns || [] };
  } catch (err: any) {
    console.error("Error in getCampaignsAction:", err);
    return { ok: false, error: err.message };
  }
}

export async function getCampaignDetailsAction(
  campaignName: string,
  createdAt: string,
  audienceSegment: string = ""
) {
  try {
    // Always fetch ALL agents (any status) so admin sees the full picture
    // Sent vs "Didn't send" is determined purely by the WhatsApp message log
    const { data: agents, error: agentsError } = await supabaseAdmin
      .from("profiles")
      .select("id, name, phone, agency_name, location, status, is_rera_approved")
      .eq("role", "agent")
      .order("name", { ascending: true });

    if (agentsError) throw agentsError;

    // Time window: 2 hours before campaign → 4 hours after (tight window avoids cross-campaign bleeding)
    const createdMs = new Date(createdAt).getTime();
    const startDate = new Date(createdMs - 1000 * 60 * 120).toISOString(); // 2h before
    const endDate   = new Date(createdMs + 1000 * 60 * 240).toISOString(); // 4h after

    // Fetch all outbound messages in that window that have an agent_id attached
    // We match by agent_id and also ensure the message content contains the campaign name 
    // to prevent concurrent campaigns from bleeding into each other's metrics
    const { data: messages, error: msgsError } = await supabaseAdmin
      .from("whatsapp_messages")
      .select("agent_id, phone")
      .eq("direction", "outbound")
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .not("agent_id", "is", null)
      .ilike("content", `%${campaignName}%`);

    if (msgsError) throw msgsError;

    // Build lookup sets
    const sentAgentIds = new Set((messages || []).map((m) => m.agent_id));
    const sentPhones   = new Set(
      (messages || []).map((m) => (m.phone || "").replace(/\D/g, ""))
    );

    // Map delivery status to each agent
    const mappedAgents = (agents || []).map((agent) => {
      const agentPhoneDigits = (agent.phone || "").replace(/\D/g, "");
      const isSent =
        sentAgentIds.has(agent.id) ||
        (agentPhoneDigits.length > 0 && sentPhones.has(agentPhoneDigits));

      return {
        ...agent,
        status: isSent ? "Sent" : "Didn't send",
      };
    });

    return { ok: true, agents: mappedAgents };
  } catch (err: any) {
    console.error("Error in getCampaignDetailsAction:", err);
    return { ok: false, error: err.message };
  }
}
