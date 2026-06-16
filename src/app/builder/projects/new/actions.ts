"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";

export interface ParsedUnit {
  unit_name: string;
  status: string;
  floor_number?: number | null;
  tower?: string | null;
  facing?: string | null;
  carpet_area_sqft?: number | null;
  price?: number | null;
  bhk_type?: string | null;
  details?: Record<string, any>;
}

export async function saveProjectAction(
  phone: string,
  name: string,
  location: string,
  city: string,
  priceEstimate: string,
  type: string,
  units: ParsedUnit[],
  recipientFilter?: "all" | "verified" | "rera",
  targetLocations?: string[],
  interestedPropertyTarget?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    let profile: any = null;

    // Try verifying server session first (most robust)
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get(sessionCookieName)?.value;
      const session = await verifySession(token);

      if (session) {
        const { data: pById } = await supabaseAdmin
          .from("profiles")
          .select("id, agency_name, credits, parent_id")
          .eq("id", session.sub)
          .maybeSingle();
        
        if (pById) {
          profile = pById;
        } else if (session.phone) {
          const { data: pByPhone } = await supabaseAdmin
            .from("profiles")
            .select("id, agency_name, credits, parent_id")
            .eq("phone", session.phone)
            .maybeSingle();
          if (pByPhone) {
            profile = pByPhone;
          }
        }
      }
    } catch (sessionErr) {
      console.warn("Session check skipped or failed inside saveProjectAction:", sessionErr);
    }

    // Fallback to phone parameter if session check didn't resolve profile
    if (!profile && phone) {
      const digits = phone.replace(/\D/g, "");
      const last10 = digits.slice(-10);
      if (last10.length === 10) {
        const formattedPhone = `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;
        const { data: pByPhone } = await supabaseAdmin
          .from("profiles")
          .select("id, agency_name, credits, parent_id")
          .eq("phone", formattedPhone)
          .maybeSingle();
        if (pByPhone) {
          profile = pByPhone;
        }
      }
    }

    if (!profile) return { ok: false, error: "Builder profile not found" };

    // Get the targeted agents count for credits validation
    let agentQuery = supabaseAdmin
      .from("profiles")
      .select("id, phone")
      .eq("role", "agent");

    if (recipientFilter === "verified") {
      agentQuery = agentQuery.eq("status", "approved");
    } else if (recipientFilter === "rera") {
      agentQuery = agentQuery.eq("is_rera_approved", true);
    }

    if (targetLocations && targetLocations.length > 0) {
      agentQuery = agentQuery.in("location", targetLocations);
    }

    if (interestedPropertyTarget && interestedPropertyTarget !== "All") {
      // Use contains for array column
      agentQuery = agentQuery.contains("interested_properties", [interestedPropertyTarget]);
    }

    const { data: agents, error: agentsError } = await agentQuery;
    if (agentsError) {
      console.error("Error querying targeted agents:", agentsError);
      return { ok: false, error: "Failed to estimate targeted agents" };
    }

    const cost = agents ? agents.length : 0;
    
    // Resolve credits validation and deduction.
    // Sub-builders now use their own assigned credits.
    let targetProfile = profile;
    let builderCredits = profile.credits || 0;

    if (builderCredits < cost) {
      return { 
        ok: false, 
        error: `Insufficient credits! Launching this project targets ${cost} agents but you only have ${builderCredits} credits.` 
      };
    }

    // Deduct credits from target profile (builder or their parent Super Builder)
    const { error: deductError } = await supabaseAdmin
      .from("profiles")
      .update({ credits: builderCredits - cost })
      .eq("id", targetProfile.id);

    if (deductError) {
      console.error("Error deducting builder credits:", deductError);
      return { ok: false, error: "Failed to process credit deduction" };
    }

    // Insert Project
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .insert({
        name,
        location: `${location}, ${city}`,
        price_range: priceEstimate,
        type: type.toLowerCase(),
        developer_id: profile.id,
        details: { city }
      })
      .select("id")
      .single();

    if (projectError || !project) {
        console.error("Project insert error:", projectError);
        return { ok: false, error: projectError?.message || "Failed to create project" };
    }

    // Insert Units
    const unitsToInsert = units.map(u => {
        const detailsMerged = {
            ...(u.details || {}),
            floor_number: u.floor_number || null,
            tower: u.tower || null,
            facing: u.facing || null,
            carpet_area_sqft: u.carpet_area_sqft || null,
            price: u.price || null,
            bhk_type: u.bhk_type || null,
            bhk: u.bhk_type || null,
        };
        return {
            project_id: project.id,
            unit_name: u.unit_name,
            status: (u.status || "available").toLowerCase() as any,
            details: detailsMerged
        };
    });

    if (unitsToInsert.length > 0) {
        const { error: unitsError } = await supabaseAdmin
            .from("inventory_units")
            .insert(unitsToInsert);

        if (unitsError) {
            console.error("Units insert error:", unitsError);
            return { ok: false, error: unitsError.message };
        }
    }

    const targetMeta = {
      verification: recipientFilter || "all",
      locations: targetLocations || []
    };
    const metaString = `\n\n<!-- TARGET: ${JSON.stringify(targetMeta)} -->`;

    // Insert an Event so it appears in the Agent "Launches" section
    await supabaseAdmin.from("events").insert({
        id: project.id, // Tie the event directly to the project ID
        title: `New Project: ${name}`,
        date: "Active",
        location: city,
        description: `New ${type} project in ${location} by ${profile.agency_name || 'Builder'}. Starting at ${priceEstimate}.${metaString}`
    });

    if (agents && agents.length > 0) {
        // Also record this broadcast in the campaigns table so it shows up in Admin Monitor
        const audienceName = `Launch: ${targetLocations && targetLocations.length > 0 ? targetLocations.join(", ") : "All Areas"} - ${recipientFilter} - ${interestedPropertyTarget || "All Types"}`;
        
        await supabaseAdmin.from("campaigns").insert({
            builder_id: profile.id,
            name: name,
            audience_segment: audienceName,
            template: "project_launch",
            sent_count: cost,
            read_rate: 0.0,
        });

        const apiKey = process.env.GALLABOX_API_KEY;
        const apiSecret = process.env.GALLABOX_API_SECRET;
        const channelId = process.env.GALLABOX_CHANNEL_ID;
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://agentsapp.online";

        await Promise.all(agents.map(async (agent) => {
            if (!agent.phone) return;
            const digits = agent.phone.replace(/\D/g, "");
            const finalPhone = digits.length === 10 ? `91${digits}` : digits;

            const followUrl = `${baseUrl}/agent/follow?project_id=${project.id}`;
            const messageText = `🚀 *New Project Launched!*\n\n*${name}* in ${location} is now live on the platform.\nStarting at ${priceEstimate}.\n\nTap the link below to follow and track this project:\n${followUrl}`;

            let status = 0;
            let errMsg: string | null = null;

            if (apiKey && apiSecret && channelId) {
                try {
                    const res = await fetch("https://server.gallabox.com/devapi/messages/whatsapp", {
                        method: "POST",
                        headers: {
                            "apiKey": apiKey,
                            "apiSecret": apiSecret,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            channelId,
                            channelType: "whatsapp",
                            recipient: { name: "Agent", phone: finalPhone },
                            whatsapp: { type: "text", text: { body: messageText } }
                        })
                    });
                    status = res.status;
                    if (!res.ok) {
                        const errData = await res.json().catch(() => ({}));
                        errMsg = JSON.stringify(errData).slice(0, 500);
                    }
                } catch (fetchErr: any) {
                    console.error("GallaBox send error:", fetchErr);
                    errMsg = fetchErr.message || String(fetchErr);
                }
            } else {
                errMsg = "GallaBox not configured (simulated)";
            }

            // Always write the message to the audit log so the agent's web chatbot can poll and receive it automatically
            await supabaseAdmin
                .from("whatsapp_messages")
                .insert({
                    direction: "outbound",
                    phone: agent.phone,
                    agent_id: agent.id,
                    message_type: "text",
                    content: messageText,
                    source: apiKey && apiSecret && channelId ? "gallabox" : "simulator",
                    outbound_status: status,
                    error_message: errMsg
                });
        }));
    }

    return { ok: true };
  } catch (err) {
    console.error("Action error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
