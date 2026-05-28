"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface ProjectWithFollow {
  id: string;
  name: string;
  location: string;
  price_range: string;
  type: string;
  is_following: boolean;
  documents_count: number;
}

export interface ProjectDocument {
  id: string;
  name: string;
  type: string;
  url: string;
  created_at: string;
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  return `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;
}

async function getAgentId(phone: string): Promise<string | null> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("phone", formatPhone(phone))
    .single();
  return profile?.id || null;
}

export async function getProjectsWithFollowStatus(phone: string): Promise<ProjectWithFollow[]> {
  const agentId = await getAgentId(phone);
  if (!agentId) return [];

  const { data: projects } = await supabaseAdmin
    .from("projects")
    .select("id, name, location, price_range, type")
    .order("created_at", { ascending: false });

  if (!projects) return [];

  // Get follows for this agent
  const { data: follows } = await supabaseAdmin
    .from("project_follows")
    .select("project_id")
    .eq("agent_id", agentId);

  const followSet = new Set((follows || []).map((f: any) => f.project_id));

  // Get document counts per project
  const { data: docs } = await supabaseAdmin
    .from("documents")
    .select("project_id");

  const docCounts = new Map<string, number>();
  (docs || []).forEach((d: any) => {
    if (d.project_id) {
      docCounts.set(d.project_id, (docCounts.get(d.project_id) || 0) + 1);
    }
  });

  return projects.map((p: any) => ({
    id: p.id,
    name: p.name,
    location: p.location,
    price_range: p.price_range,
    type: p.type,
    is_following: followSet.has(p.id),
    documents_count: docCounts.get(p.id) || 0,
  }));
}

export async function toggleFollowProject(
  phone: string,
  projectId: string,
  follow: boolean
): Promise<{ ok: boolean; error?: string }> {
  try {
    const agentId = await getAgentId(phone);
    if (!agentId) return { ok: false, error: "Profile not found" };

    if (follow) {
      const { error } = await supabaseAdmin
        .from("project_follows")
        .upsert(
          { agent_id: agentId, project_id: projectId },
          { onConflict: "agent_id,project_id" }
        );
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabaseAdmin
        .from("project_follows")
        .delete()
        .eq("agent_id", agentId)
        .eq("project_id", projectId);
      if (error) return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
  const { data: docs } = await supabaseAdmin
    .from("documents")
    .select("id, name, type, url, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return (docs || []).map((d: any) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    url: d.url,
    created_at: d.created_at,
  }));
}
