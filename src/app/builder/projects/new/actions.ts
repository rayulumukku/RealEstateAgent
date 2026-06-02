"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface ParsedUnit {
  number: string;
  config: string;
  size: string;
  price: string;
  status: "AVAILABLE" | "HOLD" | "SOLD" | "BLOCKED";
}

export async function saveProjectAction(
  phone: string,
  name: string,
  location: string,
  city: string,
  priceEstimate: string,
  type: string,
  units: ParsedUnit[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const digits = phone.replace(/\D/g, "");
    const last10 = digits.slice(-10);
    const formattedPhone = `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;

    // Get builder profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, agency_name")
      .eq("phone", formattedPhone)
      .single();

    if (!profile) return { ok: false, error: "Builder profile not found" };

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
    const unitsToInsert = units.map(u => ({
        project_id: project.id,
        unit_name: u.number,
        status: u.status.toLowerCase(),
        details: { bhk: u.config, area: u.size, price: u.price }
    }));

    if (unitsToInsert.length > 0) {
        const { error: unitsError } = await supabaseAdmin
            .from("inventory_units")
            .insert(unitsToInsert);

        if (unitsError) {
            console.error("Units insert error:", unitsError);
            return { ok: false, error: unitsError.message };
        }
    }

    // Insert an Event so it appears in the Agent "Launches" section
    await supabaseAdmin.from("events").insert({
        id: project.id, // Tie the event directly to the project ID
        title: `New Project: ${name}`,
        date: "Active",
        location: city,
        description: `New ${type} project in ${location} by ${profile.agency_name || 'Builder'}. Starting at ${priceEstimate}.`
    });

    // Notify all agents via WhatsApp
    const { data: agents } = await supabaseAdmin
        .from("profiles")
        .select("phone")
        .eq("role", "agent");

    if (agents && agents.length > 0) {
        const apiKey = process.env.GALLABOX_API_KEY;
        const apiSecret = process.env.GALLABOX_API_SECRET;
        const channelId = process.env.GALLABOX_CHANNEL_ID;
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://agent4-ochre.vercel.app";

        if (!apiKey || !apiSecret || !channelId) {
            console.warn("GallaBox not configured, skipping WhatsApp notifications.");
        } else {
            Promise.all(agents.map(async (agent) => {
                try {
                    const digits = agent.phone.replace(/\D/g, "");
                    const finalPhone = digits.length === 10 ? `91${digits}` : digits;

                    const followUrl = `${baseUrl}/agent/follow?project_id=${project.id}`;
                    const text = `🚀 *New Project Launched!*\n\n*${name}* in ${location} is now live on the platform.\nStarting at ${priceEstimate}.\n\nTap the link below to follow and track this project:\n${followUrl}`;

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
                            whatsapp: { type: "text", text: { body: text } }
                        })
                    });
                    const data = await res.json();
                    console.log(`WhatsApp sent to ${agent.phone}:`, JSON.stringify(data));
                } catch (err) {
                    console.error("Error notifying agent via WhatsApp:", agent.phone, err);
                }
            })).catch(console.error);
        }
    }

    return { ok: true };
  } catch (err) {
    console.error("Action error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
