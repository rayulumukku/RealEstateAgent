"use server";

import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

export async function getBuilderConnections(phone: string) {
  try {
    const { data: builder, error: builderErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .single();

    if (builderErr || !builder) {
      return { success: false, error: "Builder not found" };
    }

    const { data: partners, error: partnersErr } = await supabase
      .from("channel_partners")
      .select("agent_id, status")
      .eq("builder_id", builder.id);

    if (partnersErr) {
      return { success: false, error: partnersErr.message };
    }

    const connections: Record<string, "invited" | "connected" | "none"> = {};
    if (partners) {
      partners.forEach(p => {
        connections[p.agent_id] = p.status as "invited" | "connected";
      });
    }

    return { success: true, connections };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function cancelBuilderConnection(phone: string, agentId: string) {
  try {
    const { data: builder, error: builderErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .single();

    if (builderErr || !builder) {
      return { success: false, error: "Builder not found" };
    }

    const { error: deleteErr } = await supabase
      .from("channel_partners")
      .delete()
      .eq("builder_id", builder.id)
      .eq("agent_id", agentId);

    if (deleteErr) {
      return { success: false, error: deleteErr.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
