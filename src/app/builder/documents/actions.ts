"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface BuilderDocument {
  id: string;
  name: string;
  type: string;
  url: string;
  project_name: string | null;
  project_id: string | null;
  created_at: string;
  send_count: number;
  view_count: number;
}

// Fetch all documents uploaded by builders (agent_id IS NULL)
export async function getBuilderDocuments(): Promise<BuilderDocument[]> {
  const { data: docs } = await supabaseAdmin
    .from("documents")
    .select("id, name, type, url, send_count, view_count, created_at, project_id, projects(name)")
    .is("agent_id", null)
    .order("created_at", { ascending: false });

  return (docs || []).map((d: any) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    url: d.url,
    project_id: d.project_id || null,
    project_name: d.projects?.name || null,
    created_at: d.created_at,
    send_count: d.send_count || 0,
    view_count: d.view_count || 0,
  }));
}

// Fetch builder's projects to link documents
export async function getBuilderProjects(phone: string) {
  // First get profile id
  const digits = phone.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  const formattedPhone = `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("phone", formattedPhone)
    .single();

  if (!profile) return [];

  const { data: projects } = await supabaseAdmin
    .from("projects")
    .select("id, name")
    .eq("builder_id", profile.id)
    .order("name", { ascending: true });

  return projects || [];
}

// Upload a document: store file in Supabase Storage, then insert a row in documents
export async function uploadBuilderDocument(
  fileName: string,
  docType: string,
  fileBase64: string,
  mimeType: string,
  projectId: string | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Decode base64 to buffer
    const buffer = Buffer.from(fileBase64, "base64");

    // Upload to Supabase Storage bucket "agent-documents" (we can reuse the same bucket for all docs)
    const filePath = `builder_shared/${Date.now()}_${fileName}`;
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

    // Insert document record with agent_id = null
    const { error: insertError } = await supabaseAdmin.from("documents").insert({
      name: fileName,
      type: docType,
      url: publicUrl,
      project_id: projectId || null,
      agent_id: null,
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

// Delete builder document
export async function deleteBuilderDocument(
  documentId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from("documents")
      .delete()
      .eq("id", documentId)
      .is("agent_id", null);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
