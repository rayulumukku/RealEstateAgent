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

export interface FollowerInfo {
  agent_id: string;
  name: string;
  phone: string;
  agency_name: string;
  location: string;
  followed_at: string;
  status?: string;
}

export async function getFollowersForEntity(
  entityId: string,
  entityType: "project" | "event" | "campaign",
  campaignName?: string
): Promise<{ ok: boolean; followers?: FollowerInfo[]; error?: string }> {
  try {
    let targetEventId = entityId;

    if (entityType === "campaign") {
      // Find the event associated with this campaign by title matching campaignName
      const nameToSearch = campaignName || entityId; // Fallback to entityId if not passed
      const { data: eventData } = await supabaseAdmin
        .from("events")
        .select("id")
        .eq("title", nameToSearch)
        .maybeSingle();

      if (eventData) {
        targetEventId = eventData.id;
      } else {
        return { ok: true, followers: [] }; // No event created/associated
      }
    }

    if (entityType === "event" || entityType === "campaign") {
      // Query event_invitations (which contains accepted, declined, pending, and responded_at)
      let invitations = null;
      let error = null;
      try {
        const { data, error: dbErr } = await supabaseAdmin
          .from("event_invitations")
          .select("agent_id, status, responded_at, profiles:profiles(name, phone, agency_name, location)")
          .eq("event_id", targetEventId);
        invitations = data;
        error = dbErr;
      } catch (err) {
        error = err;
      }

      // Query checkins to see who attended
      let checkins = null;
      try {
        const { data } = await supabaseAdmin
          .from("event_attendance_checkins")
          .select("agent_id")
          .eq("event_id", targetEventId);
        checkins = data;
      } catch (e) {}
      const checkinAgentIds = new Set(checkins?.map((c: any) => c.agent_id) || []);

      if (error) {
        console.error("Error fetching event invitations:", error);
        return { ok: false, error: (error as any).message };
      }

      const followersList = (invitations || []).map((i: any) => {
        const hasAttended = checkinAgentIds.has(i.agent_id);
        let statusString = i.status;
        if (hasAttended) {
          statusString = "attended";
        }
        return {
          agent_id: i.agent_id,
          name: i.profiles?.name || "Agent",
          phone: i.profiles?.phone || "",
          agency_name: i.profiles?.agency_name || "Independent",
          location: i.profiles?.location || "",
          followed_at: i.responded_at || i.created_at || new Date().toISOString(),
          status: statusString
        };
      });

      return { ok: true, followers: followersList };
    }

    // Default project follow query (using project_follows or similar)
    const { data: rsvps, error } = await supabaseAdmin
      .from("rsvps")
      .select("agent_id, created_at, profiles:profiles(name, phone, agency_name, location)")
      .eq("event_id", targetEventId);

    if (error) {
      console.error("Error fetching project followers:", error);
      return { ok: false, error: error.message };
    }

    const followersList = (rsvps || []).map((r: any) => ({
      agent_id: r.agent_id,
      name: r.profiles?.name || "Agent",
      phone: r.profiles?.phone || "",
      agency_name: r.profiles?.agency_name || "Independent",
      location: r.profiles?.location || "",
      followed_at: r.created_at,
      status: "accepted"
    }));

    return { ok: true, followers: followersList };
  } catch (err) {
    console.error("Action error in getFollowersForEntity:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
