"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function getFollowedProjects(phone: string) {
  try {
    // Normalize phone to match stored format e.g. "+91 98765 43210"
    const digits = phone.replace(/\D/g, "");
    const last10 = digits.slice(-10);
    const formattedPhone = `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", formattedPhone)
      .single();

    if (!profile) {
      console.error("No profile found for phone:", formattedPhone);
      return [];
    }

    // rsvps table: every row means accepted (no status column)
    const { data: rsvps, error: rsvpError } = await supabaseAdmin
      .from("rsvps")
      .select("event_id")
      .eq("agent_id", profile.id);

    if (rsvpError) {
      console.error("RSVP fetch error:", rsvpError.message);
      return [];
    }

    if (!rsvps || rsvps.length === 0) return [];

    const eventIds = rsvps.map((r) => r.event_id);

    // Fetch projects whose IDs match the followed event IDs
    const { data: projects, error: projError } = await supabaseAdmin
      .from("projects")
      .select("*")
      .in("id", eventIds)
      .order("created_at", { ascending: false });

    if (projError) {
      console.error("Projects fetch error:", projError.message);
      return [];
    }

    return projects || [];
  } catch (err) {
    console.error("Error getting followed projects:", err);
    return [];
  }
}
