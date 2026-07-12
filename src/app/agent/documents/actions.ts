"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface AgentDocument {
  id: string;
  name: string;
  type: string;
  url: string;
  project_name: string | null;
  created_at: string;
  send_count: number;
  view_count: number;
}

// Resolve phone to profile id
async function getProfileByPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  const formattedPhone = `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("phone", formattedPhone)
    .single();
  return data;
}

// Fetch only this agent's documents
export async function getAgentDocuments(phone: string): Promise<AgentDocument[]> {
  const profile = await getProfileByPhone(phone);
  if (!profile) return [];

  const { data: docs } = await supabaseAdmin
    .from("documents")
    .select("id, name, type, url, send_count, view_count, created_at, projects(name)")
    .eq("agent_id", profile.id)
    .order("created_at", { ascending: false });

  return (docs || []).map((d: any) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    url: d.url,
    project_name: d.projects?.name || null,
    created_at: d.created_at,
    send_count: d.send_count || 0,
    view_count: d.view_count || 0,
  }));
}

// Fetch shared builder documents (where agent_id IS NULL)
export async function getSharedDocuments(): Promise<AgentDocument[]> {
  const { data: docs } = await supabaseAdmin
    .from("documents")
    .select("id, name, type, url, send_count, view_count, created_at, projects(name)")
    .is("agent_id", null)
    .order("created_at", { ascending: false });

  return (docs || []).map((d: any) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    url: d.url,
    project_name: d.projects?.name || null,
    created_at: d.created_at,
    send_count: d.send_count || 0,
    view_count: d.view_count || 0,
  }));
}

// Upload a document: store file in Supabase Storage, then insert a row in documents
export async function uploadAgentDocument(
  phone: string,
  fileName: string,
  docType: string,
  fileBase64: string,
  mimeType: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const profile = await getProfileByPhone(phone);
    if (!profile) return { ok: false, error: "Profile not found" };

    // Decode base64 to buffer
    const buffer = Buffer.from(fileBase64, "base64");

    // Upload to Supabase Storage bucket "agent-documents"
    const filePath = `${profile.id}/${Date.now()}_${fileName}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("agent-documents")
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return { ok: false, error: uploadError.message };
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from("agent-documents")
      .getPublicUrl(filePath);

    const publicUrl = urlData?.publicUrl || "#";

    // Insert document record with agent_id
    const { error: insertError } = await supabaseAdmin.from("documents").insert({
      name: fileName,
      type: docType,
      url: publicUrl,
      agent_id: profile.id,
      send_count: 0,
      view_count: 0,
    });

    if (insertError) {
      console.error("Document insert error:", insertError);
      return { ok: false, error: insertError.message };
    }

    return { ok: true };
  } catch (err) {
    console.error("Upload error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// Delete agent's own document
export async function deleteAgentDocument(
  documentId: string,
  phone: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const profile = await getProfileByPhone(phone);
    if (!profile) return { ok: false, error: "Profile not found" };

    const { error } = await supabaseAdmin
      .from("documents")
      .delete()
      .eq("id", documentId)
      .eq("agent_id", profile.id); // Ensure agent can only delete their own

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function recordBrochureView(
  documentId: string
): Promise<{ ok: boolean }> {
  try {
    const { data: doc } = await supabaseAdmin
      .from("documents")
      .select("view_count")
      .eq("id", documentId)
      .single();

    await supabaseAdmin
      .from("documents")
      .update({ view_count: (doc?.view_count || 0) + 1 })
      .eq("id", documentId);

    return { ok: true };
  } catch {
    return { ok: true };
  }
}
