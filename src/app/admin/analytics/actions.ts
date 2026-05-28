"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface AgentStat {
  id: string;
  name: string;
  phone: string;
  agency_name: string | null;
  status: string;
  leads_count: number;
  reminders_count: number;
  last_active: string | null;
}

export interface AdminAnalytics {
  total_agents: number;
  total_builders: number;
  total_leads: number;
  total_reminders: number;
  total_events: number;
  total_documents: number;
  agents: AgentStat[];
}

export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  // Total agents
  const { count: totalAgents } = await supabaseAdmin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "agent");

  // Total builders
  const { count: totalBuilders } = await supabaseAdmin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "builder");

  // Total leads
  const { count: totalLeads } = await supabaseAdmin
    .from("leads")
    .select("*", { count: "exact", head: true });

  // Total reminders
  const { count: totalReminders } = await supabaseAdmin
    .from("reminders")
    .select("*", { count: "exact", head: true });

  // Total events
  const { count: totalEvents } = await supabaseAdmin
    .from("events")
    .select("*", { count: "exact", head: true });

  // Total documents
  const { count: totalDocuments } = await supabaseAdmin
    .from("documents")
    .select("*", { count: "exact", head: true });

  // All agents with their lead counts
  const { data: agents } = await supabaseAdmin
    .from("profiles")
    .select("id, name, phone, agency_name, status, created_at")
    .eq("role", "agent")
    .order("created_at", { ascending: false });

  const agentStats: AgentStat[] = [];

  if (agents) {
    for (const agent of agents) {
      const { count: leadsCount } = await supabaseAdmin
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("agent_id", agent.id);

      const { count: remindersCount } = await supabaseAdmin
        .from("reminders")
        .select("*", { count: "exact", head: true })
        .eq("agent_id", agent.id);

      // Last lead created as proxy for "last active"
      const { data: lastLead } = await supabaseAdmin
        .from("leads")
        .select("created_at")
        .eq("agent_id", agent.id)
        .order("created_at", { ascending: false })
        .limit(1);

      agentStats.push({
        id: agent.id,
        name: agent.name,
        phone: agent.phone,
        agency_name: agent.agency_name,
        status: agent.status,
        leads_count: leadsCount || 0,
        reminders_count: remindersCount || 0,
        last_active: lastLead?.[0]?.created_at || null,
      });
    }
  }

  return {
    total_agents: totalAgents || 0,
    total_builders: totalBuilders || 0,
    total_leads: totalLeads || 0,
    total_reminders: totalReminders || 0,
    total_events: totalEvents || 0,
    total_documents: totalDocuments || 0,
    agents: agentStats,
  };
}
