"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function deleteProjectAction(projectId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) {
      console.error("Delete project error:", error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    console.error("Action error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
