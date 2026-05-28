"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface BrochureStats {
  id: string;
  name: string;
  type: string;
  project_name: string | null;
  send_count: number;
  view_count: number;
}

export async function getBrochureStats(): Promise<BrochureStats[]> {
  const { data: docs } = await supabaseAdmin
    .from("documents")
    .select("id, name, type, send_count, view_count, projects(name)")
    .order("created_at", { ascending: false });

  return (docs || []).map((d: any) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    project_name: d.projects?.name || null,
    send_count: d.send_count || 0,
    view_count: d.view_count || 0,
  }));
}

export async function recordBrochureSend(
  documentId: string,
  sentToPhone: string,
  sentByAgentPhone: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const digits = sentByAgentPhone.replace(/\D/g, "");
    const last10 = digits.slice(-10);
    const formattedPhone = `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", formattedPhone)
      .single();

    // Log the send
    await supabaseAdmin.from("brochure_sends").insert([{
      document_id: documentId,
      sent_to_phone: sentToPhone,
      sent_by: profile?.id || null,
      channel: "whatsapp",
    }]);

    // Increment send_count on document
    const { data: doc } = await supabaseAdmin
      .from("documents")
      .select("send_count")
      .eq("id", documentId)
      .single();

    await supabaseAdmin
      .from("documents")
      .update({ send_count: (doc?.send_count || 0) + 1 })
      .eq("id", documentId);

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function recordBrochureView(
  documentId: string,
  viewerPhone?: string
): Promise<{ ok: boolean }> {
  try {
    await supabaseAdmin.from("brochure_views").insert([{
      document_id: documentId,
      viewer_phone: viewerPhone || null,
    }]);

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
    return { ok: true }; // Don't fail the user experience for tracking
  }
}
