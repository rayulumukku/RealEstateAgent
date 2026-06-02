"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function markAttendance(
  phone: string,
  qrCode: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const digits = phone.replace(/\D/g, "");
    const last10 = digits.slice(-10);
    const formattedPhone = `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;

    // Get agent
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", formattedPhone)
      .single();

    if (!profile) return { ok: false, error: "Profile not found. Please log in again." };

    // Find event by QR code
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("id, title")
      .eq("qr_code_data", qrCode)
      .single();

    if (!event) return { ok: false, error: "Invalid QR code. No event found with this code." };

    // Check if already attended
    const { data: existing } = await supabaseAdmin
      .from("event_attendances")
      .select("id")
      .eq("event_id", event.id)
      .eq("agent_id", profile.id)
      .maybeSingle();

    if (existing) return { ok: false, error: `Already marked attendance for "${event.title}".` };

    // Mark attendance
    const { error } = await supabaseAdmin.from("event_attendances").insert([{
      event_id: event.id,
      agent_id: profile.id,
      qr_code: qrCode,
    }]);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
