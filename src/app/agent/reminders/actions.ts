"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface Reminder {
  id: string;
  title: string;
  scheduled_time: string;
  remind_at: string | null;
  is_completed: boolean;
  priority: string;
  lead_name: string | null;
  lead_id: string | null;
  created_at: string;
}

export async function getAgentReminders(phone: string): Promise<Reminder[]> {
  const digits = phone.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  const formattedPhone = `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("phone", formattedPhone)
    .single();

  if (!profile) return [];

  const { data: reminders } = await supabaseAdmin
    .from("reminders")
    .select("*, leads(name)")
    .eq("agent_id", profile.id)
    .order("created_at", { ascending: false });

  return (reminders || []).map((r: any) => ({
    id: r.id,
    title: r.title,
    scheduled_time: r.scheduled_time,
    remind_at: r.remind_at,
    is_completed: r.is_completed,
    priority: r.priority,
    lead_name: r.leads?.name || null,
    lead_id: r.lead_id,
    created_at: r.created_at,
  }));
}

export interface AddReminderInput {
  phone: string;
  title: string;
  remind_at: string; // ISO datetime string
  priority: string;
  lead_id?: string;
}

export async function addReminder(input: AddReminderInput): Promise<{ ok: boolean; error?: string }> {
  try {
    const digits = input.phone.replace(/\D/g, "");
    const last10 = digits.slice(-10);
    const formattedPhone = `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", formattedPhone)
      .single();

    if (!profile) return { ok: false, error: "Profile not found" };

    // Format for display
    const date = new Date(input.remind_at);
    const displayTime = date.toLocaleString("en-IN", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const { error } = await supabaseAdmin.from("reminders").insert([
      {
        agent_id: profile.id,
        lead_id: input.lead_id || null,
        title: input.title,
        scheduled_time: displayTime,
        remind_at: input.remind_at,
        is_completed: false,
        priority: input.priority || "medium",
      },
    ]);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function toggleReminderComplete(
  reminderId: string,
  completed: boolean
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from("reminders")
      .update({ is_completed: completed })
      .eq("id", reminderId);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function deleteReminder(reminderId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from("reminders")
      .delete()
      .eq("id", reminderId);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
