import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { HYDERABAD_LOCATIONS } from "@/lib/hyderabadLocations";

const mockedCheckins = new Set<string>();

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Verify a Meta WhatsApp webhook payload using the X-Hub-Signature-256 header.
 *
 * Meta signs the *raw request body* with HMAC-SHA256 using the App Secret
 * configured in the Meta App dashboard. The header is of the form
 * "sha256=<hex>". We compare with timing-safe equality.
 *
 * If WHATSAPP_APP_SECRET is not set we treat verification as disabled and
 * return true — this keeps local dev and the GallaBox/simulator paths
 * working without extra config. In production, set the secret.
 */
function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // verification disabled — see note above
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.slice("sha256=".length);

  // Lengths must match before timingSafeEqual, otherwise it throws.
  if (expected.length !== provided.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
  } catch {
    return false;
  }
}

/**
 * Insert a row into whatsapp_messages. All failures are swallowed so that
 * audit-logging never breaks the bot itself.
 */
async function logWhatsappMessage(row: {
  direction: "inbound" | "outbound";
  phone?: string | null;
  agent_id?: string | null;
  wamid?: string | null;
  message_type?: string;
  content?: string | null;
  parsed_intent?: string | null;
  parsed_entities?: Record<string, unknown> | null;
  source?: string | null;
  outbound_status?: number | null;
  error_message?: string | null;
  raw_payload?: unknown;
}) {
  try {
    await supabase.from("whatsapp_messages").insert([{
      direction: row.direction,
      phone: row.phone ?? null,
      agent_id: row.agent_id ?? null,
      wamid: row.wamid ?? null,
      message_type: row.message_type ?? "text",
      content: row.content ?? null,
      parsed_intent: row.parsed_intent ?? null,
      parsed_entities: row.parsed_entities ?? null,
      source: row.source ?? null,
      outbound_status: row.outbound_status ?? null,
      error_message: row.error_message ?? null,
      // Cap the raw payload so we don't bloat the table.
      raw_payload: row.raw_payload
        ? JSON.parse(JSON.stringify(row.raw_payload).slice(0, 4000))
        : null,
    }]);
  } catch (err) {
    console.error("whatsapp_messages insert failed:", err);
  }
}

// GET handler: Meta Webhook Subscription Handshake Verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "agentsapp_bot_verify_token";

  if (mode && token) {
    if (mode === "subscribe" && token === verifyToken) {
      console.log("WhatsApp Webhook Handshake verified successfully.");
      return new NextResponse(challenge, { status: 200 });
    } else {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }
  return new NextResponse("Bad Request", { status: 400 });
}

// POST handler: Receives incoming chat prompts from agents (Meta, GallaBox, or Simulator)
export async function POST(req: NextRequest) {
  let fromPhoneRaw = "";
  // Read the raw body once, so we can both verify the signature and parse it.
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-hub-signature-256");

  // Reject Meta-style payloads with bad signatures. GallaBox and the local
  // simulator do not send this header — when WHATSAPP_APP_SECRET is unset
  // we accept everything (see verifyMetaSignature).
  if (signatureHeader && !verifyMetaSignature(rawBody, signatureHeader)) {
    console.warn("Rejected WhatsApp webhook: invalid x-hub-signature-256");
    await logWhatsappMessage({
      direction: "inbound",
      message_type: "system",
      content: rawBody.slice(0, 1000),
      error_message: "invalid x-hub-signature-256",
      source: "meta",
    });
    return NextResponse.json({ status: "forbidden", message: "Invalid signature" }, { status: 403 });
  }

  try {
    let payload: any;
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch (parseErr) {
      console.error("WhatsApp webhook: invalid JSON body", parseErr);
      return NextResponse.json({ status: "error", message: "Invalid JSON" }, { status: 400 });
    }
    console.log("WhatsApp Webhook Payload Received:", JSON.stringify(payload));


    // Support Meta, GallaBox, and Simulator payload formats
    let textBody = (
      payload.whatsapp?.text?.body || // GallaBox whatsapp body
      payload.whatsapp?.text || // GallaBox whatsapp text
      payload.data?.message?.text?.body || // GallaBox standard
      payload.data?.message?.text || // GallaBox alternative
      payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body || // Meta
      payload.message?.text || // GallaBox legacy
      payload.message?.text?.body || // GallaBox legacy alternative
      payload.payload?.message?.text || // GallaBox nested
      payload.text || // Sandbox/direct
      ""
    ).toString().trim();

    // Detect message type and media URLs
    const msgType = (
      payload.whatsapp?.type ||
      payload.data?.message?.type ||
      payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.type ||
      payload.message?.type ||
      payload.type ||
      "text"
    );

    let mediaUrl = "";
    let mediaFileName = "";
    if (msgType === "image" || msgType === "document") {
      const mediaObj = 
        payload.whatsapp?.image || payload.whatsapp?.document ||
        payload.data?.message?.image || payload.data?.message?.document ||
        payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.image ||
        payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.document ||
        payload.message?.image || payload.message?.document;
        
      mediaUrl = mediaObj?.link || mediaObj?.url || mediaObj?.id || "media_uploaded";
      mediaFileName = mediaObj?.filename || mediaObj?.name || `${msgType}_file`;
    }

    // Clean surrounding single/double quotes
    if ((textBody.startsWith('"') && textBody.endsWith('"')) || (textBody.startsWith("'") && textBody.endsWith("'"))) {
      textBody = textBody.slice(1, -1).trim();
    }

    fromPhoneRaw = (
      payload.whatsapp?.from || // GallaBox whatsapp from
      payload.whatsapp?.sender || // GallaBox whatsapp sender
      payload.sender || // GallaBox sender
      payload.data?.contact?.phoneNumber || // GallaBox standard
      payload.data?.contact?.phone || // GallaBox alternative
      payload.data?.message?.from || // GallaBox nested message from
      payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from || // Meta
      payload.message?.from || // GallaBox legacy
      payload.payload?.message?.from || // GallaBox legacy nested
      payload.from || // Sandbox/direct
      ""
    ).toString().trim();

    if (!fromPhoneRaw) {
      console.log("Ignored payload: Missing sender phone number.");
      return NextResponse.json({ status: "ignored", message: "Missing phone" });
    }

    if (!textBody && msgType === "text") {
      console.log("Ignored payload: Missing message body.");
      await logWhatsappMessage({
        direction: "inbound",
        phone: fromPhoneRaw || null,
        message_type: "system",
        content: textBody || null,
        error_message: "missing body",
        raw_payload: payload,
      });
      return NextResponse.json({ status: "ignored", message: "Missing body" });
    }

    // Detect which BSP/source this payload is from. Used for audit logging.
    const isFromMeta = !!payload?.entry?.[0]?.changes?.[0];
    const isFromSimulatorEarly =
      payload?.entry?.[0]?.id === "sandbox-entry" ||
      payload?.from === "simulator" ||
      payload?.fromPhone === "simulator";
    const source: "meta" | "gallabox" | "simulator" =
      isFromSimulatorEarly ? "simulator" : isFromMeta ? "meta" : "gallabox";

    // Best-effort wamid extraction (Meta only).
    const wamid =
      payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id ||
      null;

    // Format phone number to match the database profile representation: "+91 98765 43210"
    const last10Digits = fromPhoneRaw.slice(-10);
    const formattedPhone = `+91 ${last10Digits.slice(0, 5)} ${last10Digits.slice(5)}`;

    // Audit-log the inbound message immediately. We don't know the
    // agent_id yet; the lookup happens further down.
    await logWhatsappMessage({
      direction: "inbound",
      phone: formattedPhone, // Fix: use formattedPhone
      wamid,
      message_type: "text",
      content: textBody,
      source,
      raw_payload: payload,
    });

    const lowerText = textBody.toLowerCase();

    // Determine if the message has our specific "aa" prefix or is from the sandbox simulator
    const isFromSimulator = payload.entry?.[0]?.id === "sandbox-entry" || payload.from === "simulator" || payload.fromPhone === "simulator";
    const hasAaPrefix = lowerText.startsWith("aa ") || lowerText === "aa";

    // Strip "aa" prefix to normalize command text for processing
    let commandText = textBody;
    if (lowerText.startsWith("aa ")) {
      commandText = textBody.slice(3).trim();
    } else if (lowerText === "aa") {
      commandText = "help";
    }

    let commandLower = commandText.toLowerCase();

    // Check if the message is a pure "yes" or "no" reply
    const isYesOrNo = commandLower === "yes" || commandLower === "no";

    // If it doesn't match our routing signature, isn't a yes/no reply, and is not from simulator, ignore it
    if (!hasAaPrefix && !isFromSimulator && !isYesOrNo && msgType === "text") {
      console.log("Ignored payload: Does not start with 'aa', isn't yes/no, and not from simulator.");
      return NextResponse.json({ status: "ignored", message: "Not intended for agentsapp bot" });
    }

    // formattedPhone is already defined above

    // Outbound helper to send messages back via GallaBox WhatsApp API
    const sendOutboundReply = async (replyText: string) => {
      const apiKey = process.env.GALLABOX_API_KEY;
      const apiSecret = process.env.GALLABOX_API_SECRET;
      const channelId = process.env.GALLABOX_CHANNEL_ID;

      // For the simulator (and any time GallaBox isn't configured) we still
      // want an audit trail of what the bot would have sent.
      if (!apiKey || !apiSecret || !channelId || isFromSimulator) {
        await logWhatsappMessage({
          direction: "outbound",
          phone: formattedPhone, // Fix: use formattedPhone so it matches history polls
          message_type: "text",
          content: replyText,
          source,
          // 0 indicates "not actually sent over the wire".
          outbound_status: 0,
          error_message: isFromSimulator ? "simulator (not sent)" : "GallaBox not configured",
        });
        return;
      }

      const cleanPhone = fromPhoneRaw.replace(/\D/g, "");
      const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      console.log(`Sending live GallaBox reply to ${finalPhone}: ${replyText}`);
      try {
        const res = await fetch("https://server.gallabox.com/devapi/messages/whatsapp", {
          method: "POST",
          headers: {
            "apiKey": apiKey,
            "apiSecret": apiSecret,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channelId: channelId,
            channelType: "whatsapp",
            recipient: { name: "Agent", phone: finalPhone },
            whatsapp: { type: "text", text: { body: replyText } },
          }),
        });

        const resData = await res.json().catch(() => ({}));
        console.log(`GallaBox reply status: ${res.status}`, JSON.stringify(resData));

        await logWhatsappMessage({
          direction: "outbound",
          phone: fromPhoneRaw,
          message_type: "text",
          content: replyText,
          source,
          outbound_status: res.status,
          error_message: res.ok ? null : JSON.stringify(resData).slice(0, 500),
          raw_payload: resData,
        });
      } catch (e: any) {
        console.error("GallaBox outbound fetch failed:", e);
        await logWhatsappMessage({
          direction: "outbound",
          phone: fromPhoneRaw,
          message_type: "text",
          content: replyText,
          source,
          outbound_status: null,
          error_message: e?.message || String(e),
        });
      }
    };

    // Query profiles in database to identify the agent
    let profile: any = null;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("phone", formattedPhone)
        .maybeSingle();
      profile = data;
    } catch (e) {
      console.warn("Database lookup failed, falling back to mock profile checks", e);
    }

    // If profile is not found (e.g., database empty / offline sandbox mode) and request is from simulator,
    // or if the phone matches the default pre-seeded number, initialize a mock profile.
    if (!profile && (isFromSimulator || formattedPhone === "+91 98765 43210")) {
      profile = {
        id: "b04b8402-9912-4cf4-91eb-7ee37d1d28ab", // standard seeded id
        phone: formattedPhone,
        role: "agent",
        name: "Sreenivas Rao",
        agency_name: "Rao Real Estate Services",
        email: "sreenivas@raorealty.in",
        status: "approved",
        cp_id: "CP-8402",
        points: 1240,
        referrals_count: 2,
        location: "Kokapet"
      };
    }

    // Handle Media Uploads (Documents/Images)
    if (msgType === "image" || msgType === "document") {
      if (!profile) {
        await sendOutboundReply(`🤖 Bot: We received a file, but your phone number is not registered. Please register first by typing *aa register [Name]*`);
        return NextResponse.json({ status: "success", reply: "Unregistered user uploaded file" });
      }

      // If the agent is in a pending verification state, log to verification_docs
      if (profile.status === "pending" || profile.status === "docs_required" || profile.status === "rejected") {
        await supabase.from("verification_docs").insert([{
          agent_id: profile.id,
          doc_type: msgType,
          file_url: mediaUrl,
          file_name: mediaFileName,
          status: "pending"
        }]);
        await supabase.from("profiles").update({ status: "docs_uploaded" }).eq("id", profile.id);
        const replyMsg = `🤖 Bot: 📄 *Verification File Received!*\nThank you for uploading your document. Our admin team will review it shortly. Your status is now *Docs Uploaded*.`;
        await sendOutboundReply(replyMsg.replace(/\\n/g, "\n"));
        return NextResponse.json({ status: "success", reply: replyMsg });
      }

      // Otherwise, save it as a regular document for the agent
      const { error: insertError } = await supabase.from("documents").insert([{
        agent_id: profile.id,
        type: "Other", // Use standard type to avoid enum/constraint errors
        url: mediaUrl,
        name: mediaFileName,
        send_count: 0,
        view_count: 0
      }]);

      if (insertError) {
        console.error("Failed to insert document:", insertError);
        await sendOutboundReply(`🤖 Bot: ❌ Failed to save your document: ${insertError.message}`);
        return NextResponse.json({ status: "error", reply: "Insert failed" });
      }

      const replyMsg = `🤖 Bot: 📄 *File Received!*\nWe've securely saved your document to your "My Documents" vault.`;
      await sendOutboundReply(replyMsg.replace(/\\n/g, "\n"));
      return NextResponse.json({ status: "success", reply: replyMsg });
    }

    // Handle Yes/No for Event Invitations or Channel Partner Invitations
    if (commandLower === "yes" || commandLower === "no") {
      // 1. Check for pending event invitations
      let pendingEventInvites: any[] | null = null;
      let eventInvitesErr = null;
      try {
        const { data, error } = await supabase
          .from("event_invitations")
          .select("*, events(title, location, date, description, attendance_code)")
          .eq("agent_id", profile.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        pendingEventInvites = data;
        eventInvitesErr = error;
      } catch (err) {
        eventInvitesErr = err;
      }

      // Offline Sandbox Fallback
      if ((!pendingEventInvites || pendingEventInvites.length === 0 || eventInvitesErr) && isFromSimulator) {
        pendingEventInvites = [
          {
            id: "mock-invite-id",
            event_id: "mock-event-id",
            agent_id: profile.id,
            status: "pending",
            events: {
              title: "Skyline Heights Launch",
              location: "Kokapet, Hyderabad",
              date: "30th May 2026, 11:00 AM",
              description: "Exclusive launch event.",
              attendance_code: "SUN7089"
            }
          }
        ];
      }

      if (pendingEventInvites && pendingEventInvites.length > 0) {
        const invite = pendingEventInvites[0];
        const event = invite.events;

        if (commandLower === "yes") {
          // Accept the event invitation
          try {
            await supabase
              .from("event_invitations")
              .update({ status: "accepted", responded_at: new Date().toISOString() })
              .eq("id", invite.id);

            // Also upsert into rsvps table to show up in dashboard and getAgentEvents
            await supabase
              .from("rsvps")
              .upsert(
                {
                  event_id: invite.event_id,
                  agent_id: profile.id,
                  qr_code: `EVENT-${invite.event_id.slice(0, 8)}-${profile.id.slice(0, 8)}`
                },
                { onConflict: "event_id,agent_id" }
              );
          } catch (dbErr) {
            console.warn("Failed to update event invite status in DB:", dbErr);
          }

          const replyMsg = `🎉 *Invitation Accepted!*\n\nYou have successfully registered for the event:\n🏆 *${event?.title || "Webinar"}*\n📅 Date: *${event?.date || "TBD"}*\n📍 Venue: *${event?.location || "Online"}*\n\nSee you there!`;
          await sendOutboundReply(replyMsg);
          return NextResponse.json({ status: "success", reply: replyMsg });
        } else {
          // Decline the event invitation
          try {
            await supabase
              .from("event_invitations")
              .update({ status: "declined", responded_at: new Date().toISOString() })
              .eq("id", invite.id);

            // Delete from rsvps table if exists
            await supabase
              .from("rsvps")
              .delete()
              .eq("event_id", invite.event_id)
              .eq("agent_id", profile.id);
          } catch (dbErr) {
            console.warn("Failed to delete event invite status in DB:", dbErr);
          }

          const replyMsg = `🤖 *Understood.*\n\nYou have declined the invitation to *${event?.title || "the event"}*. Thank you for letting us know!`;
          await sendOutboundReply(replyMsg);
          return NextResponse.json({ status: "success", reply: replyMsg });
        }
      }

      // 2. Fallback to Channel Partner Invitations
      // Find pending invitations for this agent
      const { data: invites, error: invitesErr } = await supabase
        .from("channel_partners")
        .select("builder_id, status, reward_points")
        .eq("agent_id", profile.id)
        .eq("status", "invited");

      if (!invitesErr && invites && invites.length > 0) {
        // Just process the first pending invitation
        const invite = invites[0];
        
        if (commandLower === "yes") {
          await supabase
            .from("channel_partners")
            .update({ status: "connected" })
            .eq("agent_id", profile.id)
            .eq("builder_id", invite.builder_id);
            
          // Reward agent with builder's configured reward points
          const pointsReward = invite.reward_points !== undefined && invite.reward_points !== null ? invite.reward_points : 500;
          
          await supabase
            .from("profiles")
            .update({ points: (profile.points || 0) + pointsReward })
            .eq("id", profile.id);

          const replyMsg = `🎉 *Awesome!*\n\nYou are now an official Channel Partner.\n\n💰 We have credited *${pointsReward} bonus credits* to your account!`;
          await sendOutboundReply(replyMsg);
          return NextResponse.json({ status: "success", reply: replyMsg });
        } else {
          // They said no
          await supabase
            .from("channel_partners")
            .update({ status: "rejected" })
            .eq("agent_id", profile.id)
            .eq("builder_id", invite.builder_id);
            
          const replyMsg = `🤖 *Understood.*\n\nYou have declined the Channel Partner invitation. Let us know if you change your mind in the future.`;
          await sendOutboundReply(replyMsg);
          return NextResponse.json({ status: "success", reply: replyMsg });
        }
      }
    }

    // Handle Registration Commands
    if (commandLower.startsWith("register") || commandLower.includes("register")) {
      const matchWithAll = commandText.match(/register\s+(.*?)\s+phone\s+(.*?)\s+agency\s+(.*?)\s+location\s+(.*?)\s+interested in\s+(.*)/i);
      const matchWithPhone = commandText.match(/register\s+(.*?)\s+phone\s+(.*?)\s+agency\s+(.*)/i);
      const matchWithoutPhone = commandText.match(/register\s+(.*?)\s+agency\s+(.*)/i);
      
      const match = matchWithAll || matchWithPhone || matchWithoutPhone;

      if (match) {
        let regName = match[1].trim();
        let regPhone = matchWithAll || matchWithPhone ? match[2].trim() : formattedPhone;
        let regAgency = matchWithAll ? match[3].trim() : matchWithPhone ? match[3].trim() : match[2].trim();
        let regLocation = matchWithAll ? match[4].trim() : "";
        let regInterested = matchWithAll ? match[5].trim() : "";

        // Strip square brackets if the user typed them literally
        if (regName.startsWith("[") && regName.endsWith("]")) regName = regName.slice(1, -1).trim();
        if (regAgency.startsWith("[") && regAgency.endsWith("]")) regAgency = regAgency.slice(1, -1).trim();
        if (regPhone.startsWith("[") && regPhone.endsWith("]")) regPhone = regPhone.slice(1, -1).trim();
        if (regLocation.startsWith("[") && regLocation.endsWith("]")) regLocation = regLocation.slice(1, -1).trim();
        if (regInterested.startsWith("[") && regInterested.endsWith("]")) regInterested = regInterested.slice(1, -1).trim();

        let interestedArr: string[] = [];
        if (regInterested) {
           interestedArr = regInterested.split(",").map((i: string) => i.trim());
        }

        const cleanInputPhone = regPhone.replace(/\D/g, "");
        const finalPhoneForDb = cleanInputPhone.length >= 10 
          ? `+91 ${cleanInputPhone.slice(-10).slice(0, 5)} ${cleanInputPhone.slice(-10).slice(5)}` 
          : formattedPhone;

        let dbError = null;
        let generatedId = profile?.cp_id || null;

        if (profile) {
          // UPDATE existing profile
          const { error } = await supabase
            .from("profiles")
            .update({
              phone: finalPhoneForDb,
              name: regName,
              agency_name: regAgency,
              location: regLocation,
              interested_properties: interestedArr
            })
            .eq("id", profile.id);
          dbError = error;
        } else {
          // INSERT new profile
          const { error } = await supabase
            .from("profiles")
            .insert([{
              phone: finalPhoneForDb,
              name: regName,
              agency_name: regAgency,
              role: "agent",
              status: "pending",
              cp_id: null,
              points: 500,
              referrals_count: 0,
              location: regLocation,
              interested_properties: interestedArr
            }]);
          dbError = error;
        }

        if (dbError) {
          console.error("Failed to register agent via WhatsApp:", dbError);
          const replyErr = `🤖 Bot: ❌ Failed to register/update: ${dbError.message}`;
          await sendOutboundReply(replyErr);
          return NextResponse.json({ status: "error", reply: replyErr });
        } else {
          const locText = regLocation ? `\n📍 Location: *${regLocation}*` : "";
          const intText = regInterested ? `\n🏡 Interested: *${regInterested}*` : "";
          const replyOk = `🎉 *Registration ${profile ? "Updated" : "Successful"}!*\n\n👤 Name: *${regName}*\n🏢 Agency: *${regAgency}*\n📞 Phone: *${finalPhoneForDb}*${locText}${intText}\n💰 Welcome Reward: *+500 XP*\n\n⚠️ *Action Required:*\nPlease reply to this message with your *RERA Document, Aadhar, and PAN* to get verified.\n\nYour account is currently *pending approval* by an admin.`;
          await sendOutboundReply(replyOk);
          return NextResponse.json({ status: "success", reply: replyOk });
        }
      } else {
        const replyFormat = `🤖 *AgentsApp Onboarding*:\n\nTo register as a Channel Partner directly on WhatsApp, please reply in this format:\n\n_"aa Register Your Name phone 9999999999 agency Agency Name location Your City interested in Property Types"_`;
        await sendOutboundReply(replyFormat);
        return NextResponse.json({ status: "success", reply: replyFormat });
      }
    }

    if (!profile) {
      // If not a registration command, ask them to register
      const replyRegPrompt = `🤖 *Welcome to AgentsApp!*\n\nIt looks like your phone number is not registered yet as a Channel Partner.\n\nTo create your account instantly on WhatsApp, please reply with:\n\n_"aa Register Your Name phone 9999999999 agency Your Agency Name"_`;
      await sendOutboundReply(replyRegPrompt);
      return NextResponse.json({ status: "success", reply: replyRegPrompt });
    }

    if (commandLower === "help" || commandLower === "commands" || commandLower === "hi" || commandLower === "hello" || commandLower === "menu") {
      // Role-based menu: show different options depending on agent/builder/admin
      let helpMsg = "";

      if (profile.role === "builder") {
        helpMsg = `🤖 *AgentsApp Builder Menu*\n\n` +
          `👋 Welcome *${profile.name}* (${profile.agency_name || "Builder"})!\n\n` +
          `Manage your projects and campaigns:\n\n` +
          `1. 🚀 *Upcoming Launches*:\n` +
          `   _"aa launches"_ — view all scheduled launches\n\n` +
          `2. 🎥 *Register Webinar*:\n` +
          `   _"aa webinars"_ — view/register agent webinars\n\n` +
          `3. 👥 *My Agents*:\n` +
          `   _"aa my agents"_ — list registered channel partners\n\n` +
          `4. 🏢 *Search Inventory*:\n` +
          `   _"aa inventory"_ — view your project units\n\n` +
          `5. 📁 *Brochures*:\n` +
          `   _"aa brochure [project]"_ — send brochure to agents\n\n` +
          `6. 📊 *Campaign Stats*:\n` +
          `   _"aa stats"_ — view campaign analytics\n\n` +
          `👉 Prefix all commands with *aa*`;
      } else if (profile.role === "admin" || profile.role === "verification" || profile.role === "operations") {
        helpMsg = `🤖 *AgentsApp Admin Menu*\n\n` +
          `👋 Welcome *${profile.name}* (Admin)!\n\n` +
          `Full platform access:\n\n` +
          `📊 *Analytics & Reports*\n` +
          `1. _"aa agents"_ — list all registered agents\n` +
          `2. _"aa leads"_ — total lead count across platform\n` +
          `3. _"aa stats"_ — platform-wide analytics\n\n` +
          `👥 *Agent Management*\n` +
          `4. _"aa pending"_ — view pending verifications\n` +
          `5. _"aa approve [name]"_ — approve an agent\n` +
          `6. _"aa reject [name]"_ — reject an agent\n\n` +
          `🏢 *Inventory & Projects*\n` +
          `7. _"aa inventory"_ — search all inventory\n` +
          `8. _"aa projects"_ — list all projects\n\n` +
          `📅 *Events*\n` +
          `9. _"aa launches"_ — upcoming events\n` +
          `10. _"aa webinars"_ — active webinars\n\n` +
          `👉 Prefix all commands with *aa*`;
      } else {
        // Default: Agent/Agent menu
        helpMsg = `🤖 *AgentsApp Agent Menu*\n\n` +
          `👋 Welcome *${profile.name}* (${profile.agency_name || "Agent"})!\n` +
          `🆔 CP ID: *${profile.cp_id || "Pending"}*\n\n` +
          `📋 *Leads*\n` +
          `1. _"aa Add Name looking for BHK"_ — add lead\n` +
          `2. _"aa My leads"_ — view all your leads\n` +
          `3. _"aa Search Name"_ — find a specific lead\n` +
          `4. _"aa Name site visit"_ — update lead status\n\n` +
          `⏰ *Reminders*\n` +
          `5. _"aa Remind me to call [Name] time [date]"_ — set reminder\n` +
          `6. _"aa my reminders"_ — view pending reminders\n\n` +
          `🏢 *Inventory & Projects*\n` +
          `7. _"aa inventory"_ — view available units\n` +
          `8. _"aa brochure [project]"_ — get brochure PDF\n` +
          `9. _"aa my projects"_ — projects you follow\n\n` +
          `📅 *Events*\n` +
          `10. _"aa launches"_ — upcoming events & meets\n` +
          `11. _"aa webinars"_ — register for webinars\n` +
          `12. _"aa my events"_ — your accepted RSVPs\n\n` +
          `🏆 *Rewards*\n` +
          `13. _"aa rewards"_ — your XP balance & rank\n` +
          `14. _"aa leaderboard"_ — top 10 agents\n` +
          `15. _"aa my referrals"_ — agents you referred\n\n` +
          `👤 *Profile*\n` +
          `16. _"aa my profile"_ — your full profile details\n` +
          `17. _"aa dashboard"_ — quick stats summary\n\n` +
          `👉 Prefix all commands with *aa*`;
      }

      await sendOutboundReply(helpMsg);
      return NextResponse.json({ status: "success", reply: helpMsg });
    }
    // --- CONVERSATIONAL STATE MACHINE SETUP ---
    // Fetch the last outbound message sent by the bot to this phone number
    let lastBotMessageStr = "";
    if (formattedPhone) {
      const { data: lastMsg } = await supabase
        .from("whatsapp_messages")
        .select("content")
        .eq("direction", "outbound")
        .eq("phone", formattedPhone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastMsg) {
        lastBotMessageStr = lastMsg.content;
      }
    }

    // --- CONVERSATIONAL STATE MACHINE: INVENTORY FILTER ---
    if (lastBotMessageStr.includes("Filter this list?") && lastBotMessageStr.includes("Reply with your preferred location")) {
      // If the bot just asked them to filter, treat their next message as an inventory query
      if (!commandLower.includes("inventory")) {
        commandLower = "inventory " + commandLower;
      }
    }

    // --- CONVERSATIONAL STATE MACHINE: LEADS FILTER ---
    if (lastBotMessageStr.includes("Filter these leads?") && lastBotMessageStr.includes("Reply with a location")) {
      if (!commandLower.includes("my leads") && !commandLower.includes("show leads")) {
        commandLower = "my leads " + commandLower;
      }
    }

    // --- SMART SEARCH: REMINDERS ---
    if (commandLower === "reminder" || commandLower === "reminders" || commandLower === "my reminders") {
      const { data: reminders } = await supabase.from("reminders").select("*").eq("agent_id", profile.id).eq("is_completed", false);
      if (!reminders || reminders.length === 0) {
        await sendOutboundReply(`🤖 Bot: You have no pending reminders!`);
        return NextResponse.json({ status: "success" });
      }
      const rList = reminders.map((r: any) => `⏰ *${r.scheduled_time}*\n${r.title}`).join("\n\n");
      const rep = `🤖 Bot: Here are your reminders:\n\n${rList}`;
      await sendOutboundReply(rep);
      return NextResponse.json({ status: "success" });
    }

    // --- SMART SEARCH: PROJECTS ---
    if (commandLower.startsWith("find projects by ")) {
       const builderName = commandText.replace(/find projects by /i, "").trim();
       const { data: builders } = await supabase.from("profiles").select("id, name").eq("role", "builder").ilike("name", `%${builderName}%`);
       if (!builders || builders.length === 0) {
          await sendOutboundReply(`🤖 Bot: Could not find any builders matching "${builderName}".`);
          return NextResponse.json({ status: "success" });
       }
       const builderId = builders[0].id;
       const { data: projs } = await supabase.from("projects").select("*").eq("developer_id", builderId);
       if (!projs || projs.length === 0) {
          await sendOutboundReply(`🤖 Bot: Builder ${builders[0].name} has no listed projects.`);
          return NextResponse.json({ status: "success" });
       }
       const pList = projs.map((p: any) => `🏢 *${p.name}*\n📍 ${p.location} | 💰 ${p.price_range}`).join("\n\n");
       const rep = `🤖 Bot: Projects by ${builders[0].name}:\n\n${pList}`;
       await sendOutboundReply(rep);
       return NextResponse.json({ status: "success" });
    }

    // --- SMART SEARCH: INVENTORY ---
    if (commandLower.startsWith("search for a ") || commandLower.startsWith("search ")) {
       const cleanCmd = commandLower.replace("search for a ", "").replace("search ", "");
       const bhkMatch = cleanCmd.match(/(\d)\s*bhk/i);
       const typeMatch = cleanCmd.match(/(flat|villa|plot|apartment)/i);
       const locMatch = cleanCmd.match(/in (.*)/i);

       const bhk = bhkMatch ? bhkMatch[0] : "";
       let pType = typeMatch ? typeMatch[1].toLowerCase() : "";
       if (pType === "flat") pType = "apartment";
       const loc = locMatch ? locMatch[1].trim() : "";

       let q = supabase.from("projects").select("id, name, location");
       if (loc) q = q.ilike("location", `%${loc}%`);
       if (pType) q = q.eq("type", pType);

       const { data: projs } = await q;
       if (!projs || projs.length === 0) {
          await sendOutboundReply(`🤖 Bot: Could not find any ${pType || "properties"} in ${loc || "that area"}.`);
          return NextResponse.json({ status: "success" });
       }

       const pList = projs.map((p: any) => `🏢 *${p.name}* in ${p.location}`).join("\n");
       const rep = `🤖 Bot: I found these matches:\n\n${pList}`;
       await sendOutboundReply(rep);
       return NextResponse.json({ status: "success" });
    }

    // --- CONVERSATIONAL STATE MACHINE: ADD LEAD ---
    // State 1: Awaiting Property Type
    if (lastBotMessageStr.includes("Is ") && lastBotMessageStr.includes(" looking for a flat, villa, or plot?")) {
      const nameMatch = lastBotMessageStr.match(/Is (.*?) looking for a flat, villa, or plot\?/);
      if (nameMatch) {
        const leadName = nameMatch[1];
        const propertyType = commandText.trim();
        const replyType = `🤖 Bot: Got it, a ${propertyType}. What is ${leadName}'s budget?`;
        await sendOutboundReply(replyType);
        return NextResponse.json({ status: "success", reply: replyType });
      }
    }

    // State 2: Awaiting Budget
    if (lastBotMessageStr.includes("Got it, a ") && lastBotMessageStr.includes("What is ") && lastBotMessageStr.includes("'s budget?")) {
      const typeMatch = lastBotMessageStr.match(/Got it, a (.*?)\./);
      const nameMatch = lastBotMessageStr.match(/What is (.*?)'s budget\?/);
      if (typeMatch && nameMatch) {
        const propertyType = typeMatch[1];
        const leadName = nameMatch[1];
        const budget = commandText.trim();

        const { error } = await supabase
          .from("leads")
          .insert([{
            agent_id: profile.id,
            name: leadName,
            status: "new",
            requirement: propertyType,
            budget: budget,
            phone: "+91 00000 00000",
            details: { aiScore: 85, lastInteraction: "Added via conversational bot" }
          }]);
        
        if (error) {
           const replyErr = `🤖 Bot: ❌ Failed to add lead: ${error.message}`;
           await sendOutboundReply(replyErr);
           return NextResponse.json({ status: "error", reply: replyErr });
        }
        
        const replyOk = `🤖 Bot: ✅ Lead Added!\n👤 Name: *${leadName}*\n🏠 Req: *${propertyType}*\n💰 Budget: *${budget}*\n\n(This was inserted in your live leads table!)`;
        await sendOutboundReply(replyOk);
        return NextResponse.json({ status: "success", reply: replyOk });
      }
    }

    // Entry Point: "add a client sreenivas" or "add lead sreenivas"
    if (commandLower.startsWith("add a client ") || commandLower.startsWith("add lead ")) {
      const leadName = commandText.replace(/add a client/i, "").replace(/add lead/i, "").trim();
      if (!leadName) {
         const rep = `🤖 Bot: Please provide the client's name. Example: "add a client Sreenivas"`;
         await sendOutboundReply(rep);
         return NextResponse.json({ status: "success", reply: rep });
      }
      const replyStart = `🤖 Bot: Great! Is ${leadName} looking for a flat, villa, or plot?`;
      await sendOutboundReply(replyStart);
      return NextResponse.json({ status: "success", reply: replyStart });
    }

 

    // 3. SET REMINDER INTENT (Support: "Remind me tomorrow to call Ramesh", etc.)
    if (commandLower.startsWith("remind") || commandLower.includes("remind")) {
      let title = "WhatsApp Follow-up Task";
      let scheduledTime = "Tomorrow, 10:00 AM";

      // Remove "remind me to "
      let content = commandText.replace(/^remind\s*(me\s*)?(to\s*)?/i, "").trim();
      
      // Look for time indicators at the end of the sentence
      const timeRegex = /\b(at|on|by|time|tomorrow|today)\b\s*(.*)$/i;
      const timeMatch = content.match(timeRegex);

      if (timeMatch) {
         scheduledTime = timeMatch[0].trim();
         // If "tomorrow call ramesh", the time indicator is at the beginning.
         // Let's just strip the matched time part from the title.
         title = content.replace(timeRegex, "").trim();
      } else {
         title = content;
      }

      if (!title) title = "WhatsApp Follow-up Task";
      
      // Strip square brackets if any
      if (title.startsWith("[") && title.endsWith("]")) title = title.slice(1, -1).trim();
      if (scheduledTime.startsWith("[") && scheduledTime.endsWith("]")) scheduledTime = scheduledTime.slice(1, -1).trim();

      // Find if there is a matching lead to link
      const { data: matchingLeads } = await supabase
        .from("leads")
        .select("id")
        .eq("agent_id", profile.id)
        .limit(1);

      const leadId = matchingLeads && matchingLeads.length > 0 ? matchingLeads[0].id : null;

      // Insert reminder in Supabase
      const { data: newReminder, error } = await supabase
        .from("reminders")
        .insert([{
          agent_id: profile.id,
          lead_id: leadId,
          title: title,
          scheduled_time: scheduledTime,
          is_completed: false,
          priority: "high"
        }])
        .select()
        .single();

      if (error) {
        console.error("Failed to insert reminder via WhatsApp bot:", error);
        const replyErr = `🤖 Bot: ❌ Failed to save reminder: ${error.message}`;
        await sendOutboundReply(replyErr);
        return NextResponse.json({ status: "error", reply: replyErr });
      } else {
        console.log("Successfully logged reminder via WhatsApp bot:", newReminder);
        const replyOk = `🤖 Bot: ⏰ Reminder Scheduled!\n⏰ Task: *${title}*\n📅 Time: *${scheduledTime}*\n\n(Successfully logged in your Supabase reminders table!)`;
        await sendOutboundReply(replyOk);
        return NextResponse.json({ status: "success", reply: replyOk });
      }
    }

    // 4. UPDATE LEAD STATUS INTENT
    const statusKeywords = [
      { key: "site visit", status: "site_visit" },
      { key: "site_visit", status: "site_visit" },
      { key: "interested", status: "interested" },
      { key: "negotiation", status: "negotiation" },
      { key: "closed", status: "closed" },
      { key: "won", status: "closed" },
      { key: "lost", status: "lost" },
      { key: "new", status: "new" }
    ];

    let matchedStatus: string | null = null;
    for (const item of statusKeywords) {
      if (commandLower.includes(item.key)) {
        matchedStatus = item.status;
        break;
      }
    }

    if (matchedStatus) {
      const { data: agentLeads } = await supabase
        .from("leads")
        .select("id, name")
        .eq("agent_id", profile.id);

      let matchedLead = null;
      if (agentLeads) {
        for (const lead of agentLeads) {
          const nameLower = lead.name.toLowerCase();
          if (commandLower.includes(nameLower)) {
            matchedLead = lead;
            break;
          }
          const firstName = nameLower.split(" ")[0];
          if (firstName.length >= 3 && commandLower.includes(firstName)) {
            matchedLead = lead;
            break;
          }
        }
      }

      if (matchedLead) {
        const { data: updatedLead, error } = await supabase
          .from("leads")
          .update({ status: matchedStatus })
          .eq("id", matchedLead.id)
          .select()
          .single();

        if (error) {
          console.error("Failed to update lead status via WhatsApp bot:", error);
          const replyErr = `🤖 Bot: ❌ Failed to update status: ${error.message}`;
          await sendOutboundReply(replyErr);
          return NextResponse.json({ status: "error", reply: replyErr });
        } else {
          const replyOk = `🤖 Bot: ✅ Lead Status Updated!\n👤 Name: *${matchedLead.name}*\n⚡ New Status: *${matchedStatus.toUpperCase()}*\n\n(Kanban board is synced with this update in real time!)`;
          await sendOutboundReply(replyOk);
          return NextResponse.json({ status: "success", reply: replyOk });
        }
      }
    }

    // 5. VIEW LEADS INTENT
    if (
      commandLower.includes("my leads") || 
      commandLower.includes("show leads") || 
      commandLower.includes("list leads") || 
      commandLower.includes("all leads") || 
      commandLower.includes("hot leads")
    ) {
      let query = supabase
        .from("leads")
        .select("*")
        .eq("agent_id", profile.id);

      // Extract location filter (e.g. "in kokapet", "near banjara hills" or just "kokapet")
      let locationFilter = "";
      // 1. Try with preposition prefix (in/near/at)
      const locMatch = commandLower.match(/(?:in|near|at)\s+([a-z0-9\s]+?)(?:\s+(?:under|below|budget|around|above|over|less than|more than)|$)/);
      if (locMatch && locMatch[1]) {
        locationFilter = locMatch[1].trim();
      } else {
        // 2. Check if any known location name exists in the command
        const matchedLoc = HYDERABAD_LOCATIONS.find(loc => 
          commandLower.includes(loc.toLowerCase())
        );
        if (matchedLoc) {
          locationFilter = matchedLoc;
        } else {
          // 3. Fallback: if the command was just a word like "kokapet" and not containing other commands, extract the remainder
          const locPart = commandLower
            .replace(/my leads|show leads|list leads|all leads|hot leads/g, "")
            .replace(/(under|below|budget|around|above|over|less than|more than)\s+([0-9\.]+\s*(?:cr|l|c|k|crore|lakhs?))/g, "")
            .replace(/[0-9\.]+\s*(?:cr|l|c|k|crore|lakhs?)/g, "")
            .trim();
          if (locPart && locPart.length > 2 && !["leads", "show", "list", "all", "hot"].includes(locPart)) {
            locationFilter = locPart;
          }
        }
      }

      if (locationFilter) {
        query = query.ilike("location", `%${locationFilter}%`);
      }

      // Extract budget filter (e.g. "under 2cr", "budget 50l", or just "2cr")
      let budgetFilter = "";
      let budgetKeyword = "";
      const budgetMatchWithKeyword = commandLower.match(/(under|below|budget|around|above|over|less than|more than)\s+([0-9\.]+\s*(?:cr|l|c|k|crore|lakhs?))/);
      if (budgetMatchWithKeyword && budgetMatchWithKeyword[2]) {
        budgetKeyword = budgetMatchWithKeyword[1].trim();
        budgetFilter = budgetMatchWithKeyword[2].trim();
      } else {
        const budgetMatchDirect = commandLower.match(/([0-9\.]+\s*(?:cr|l|c|k|crore|lakhs?))/);
        if (budgetMatchDirect && budgetMatchDirect[1]) {
          budgetFilter = budgetMatchDirect[1].trim();
          budgetKeyword = "around"; // default fallback behavior
        }
      }

      let leads: any[] | null = null;
      let leadsError = null;
      try {
        const { data, error } = await query.order("created_at", { ascending: false });
        leads = data;
        leadsError = error;
      } catch (err) {
        leadsError = err;
      }

      // Fallback mock leads if DB empty or query fails
      if (!leads || leads.length === 0 || leadsError) {
        leads = [
          {
            id: "c01b1111-2222-3333-4444-555555555555",
            agent_id: profile.id,
            name: "Ramesh Kumar",
            phone: "+91 99123 45678",
            email: "ramesh@gmail.com",
            status: "site_visit",
            requirement: "3 BHK",
            location: "Kokapet",
            budget: "< ₹2.00 Cr",
            details: { notes: "Looking for premium skyline views, scheduled site visit for this evening." }
          },
          {
            id: "c02b1111-2222-3333-4444-555555555555",
            agent_id: profile.id,
            name: "Neha Singh",
            phone: "+91 98450 99122",
            email: "neha@singh.in",
            status: "interested",
            requirement: "2 BHK",
            location: "Financial Dist",
            budget: "< ₹1.20 Cr",
            details: { notes: "Requested price sheets and location layout details." }
          }
        ];
        
        // Manual filter application on mock data if locationFilter is set
        if (locationFilter) {
          leads = leads.filter(l => l.location.toLowerCase().includes(locationFilter.toLowerCase()));
        }
      }

      if (leads && leads.length > 0) {
        if (budgetFilter) {
          const parseBudgetToLakhs = (budgetStr: string) => {
            if (!budgetStr) return null;
            const numMatch = budgetStr.match(/([0-9\.]+)/);
            if (!numMatch) return null;
            let num = parseFloat(numMatch[1]);
            const lowerStr = budgetStr.toLowerCase();
            if (lowerStr.includes('cr') || (lowerStr.includes('c') && !lowerStr.includes('loc'))) {
              num = num * 100;
            } else if (lowerStr.includes('k')) {
              num = num / 100;
            }
            return num;
          };

          const userBudgetLakhs = parseBudgetToLakhs(budgetFilter);
          if (userBudgetLakhs !== null) {
            const isUnder = ["under", "below", "less than"].includes(budgetKeyword);
            const isOver = ["above", "over", "more than"].includes(budgetKeyword);

            leads = leads.filter(l => {
              if (!l.budget) return false;
              const leadBudgetLakhs = parseBudgetToLakhs(l.budget);
              if (leadBudgetLakhs === null) return false;
              
              if (isUnder) return leadBudgetLakhs <= userBudgetLakhs;
              if (isOver) return leadBudgetLakhs >= userBudgetLakhs;
              return leadBudgetLakhs >= userBudgetLakhs * 0.8 && leadBudgetLakhs <= userBudgetLakhs * 1.2;
            });
          }
        }
      }

      if (!leads || leads.length === 0) {
        let replyEmpty = "🤖 Bot: You don't have any leads registered yet. Add one by typing:\n\"aa Add lead Name phone 9999999999\"";
        if (locationFilter || budgetFilter) {
          replyEmpty = `🤖 Bot: No leads found matching your filters: ${locationFilter ? `📍 Loc: ${locationFilter}` : ""} ${budgetFilter ? `💰 Budget: ${budgetFilter}` : ""}`;
        }
        await sendOutboundReply(replyEmpty);
        return NextResponse.json({ status: "success", reply: replyEmpty });
      }

      let replyMsg = `🤖 *Your CRM Leads List*\n`;
      if (locationFilter || budgetFilter) {
        replyMsg += `*(Filtered by: ${locationFilter ? locationFilter + " " : ""}${budgetFilter ? budgetFilter : ""})*\n\n`;
      } else {
        replyMsg += `\n`;
      }
      
      leads.forEach((l, idx) => {
        const emojiMap: Record<string, string> = {
          new: "🆕",
          interested: "💡",
          site_visit: "🚗",
          negotiation: "🤝",
          closed: "🎉",
          lost: "❌"
        };
        const emoji = emojiMap[l.status] || "👤";
        replyMsg += `${idx + 1}. ${emoji} *${l.name}* (${l.phone || "No phone"})`;
        if (l.location || l.requirement) {
          replyMsg += `\n   📍 Loc: ${l.location || "-"} | Req: ${l.requirement || "-"}`;
        }
        if (l.budget) {
          replyMsg += `\n   💰 Budget: ${l.budget}`;
        }
        replyMsg += `\n   ⚡ Status: *${l.status.toUpperCase()}*\n\n`;
      });
      
      const isLeadsFiltered = locationFilter || budgetFilter;
      if (!isLeadsFiltered && leads.length > 0) {
        replyMsg += `\n🤖 *Filter these leads?*\nReply with a location (e.g. Kokapet) or budget (e.g. under 1cr) to filter.`;
      }
      
      await sendOutboundReply(replyMsg.trim());
      return NextResponse.json({ status: "success", reply: replyMsg.trim() });
    }

    // 6. REQUEST BROCHURE / DOCUMENT INTENT
    if (
      commandLower.includes("brochure") || 
      commandLower.includes("floor plan") || 
      commandLower.includes("price list") || 
      commandLower.includes("layout")
    ) {
      const { data: docs } = await supabase
        .from("documents")
        .select("*, projects(name)");

      if (!docs || docs.length === 0) {
        const replyEmpty = "🤖 Bot: No brochures or price list documents found in vault.";
        await sendOutboundReply(replyEmpty);
        return NextResponse.json({ status: "success", reply: replyEmpty });
      }

      let matchedDoc = null;
      for (const doc of docs) {
        const nameLower = doc.name.toLowerCase();
        const projNameLower = doc.projects?.name?.toLowerCase() || "";
        
        if (commandLower.includes(nameLower) || (projNameLower && commandLower.includes(projNameLower))) {
          matchedDoc = doc;
          break;
        }
      }

      if (!matchedDoc) {
        matchedDoc = docs[0]; // Fallback to first document
      }

      const docUrl = matchedDoc.url === "#" ? "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" : matchedDoc.url;
      const replyDoc = `🤖 Bot: 📁 Document Retrieved!\n📄 Name: *${matchedDoc.name}*\n📥 Type: *${matchedDoc.type}*\n🏢 Project: *${matchedDoc.projects?.name || "General"}*\n\n🔗 *Download Link*:\n${docUrl}\n\n(Tap the link to download details instantly.)`;
      
      await sendOutboundReply(replyDoc);
      return NextResponse.json({ status: "success", reply: replyDoc });
    }

    // 7. UPCOMING LAUNCHES / EVENTS INTENT
    if (commandLower.includes("launch") || commandLower.includes("event") || commandLower.includes("meet")) {
      const { data: events } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });

      if (!events || events.length === 0) {
        const replyEmpty = "🤖 Bot: No upcoming launches or developer events scheduled at this moment.";
        await sendOutboundReply(replyEmpty);
        return NextResponse.json({ status: "success", reply: replyEmpty });
      }

      let replyMsg = `🚀 *Upcoming Launches & CP Meets*:\n\n`;
      events.forEach((ev, idx) => {
        replyMsg += `${idx + 1}. 📅 *${ev.title}*\n   📅 Date: *${ev.date}*\n   📍 Venue: *${ev.location}*\n   📝 Description: ${ev.description || "N/A"}\n\n`;
      });
      await sendOutboundReply(replyMsg.trim());
      return NextResponse.json({ status: "success", reply: replyMsg.trim() });
    }

    // 8. WEBINAR REGISTRATION INTENT
    if (commandLower.includes("webinar")) {
      const { data: webinars } = await supabase
        .from("webinars")
        .select("*")
        .order("created_at", { ascending: false });

      if (!webinars || webinars.length === 0) {
        const replyEmpty = "🤖 Bot: No active agent webinars scheduled. Check back later!";
        await sendOutboundReply(replyEmpty);
        return NextResponse.json({ status: "success", reply: replyEmpty });
      }

      const targetWebinar = webinars[0]; // Register for the latest upcoming webinar

      if (commandLower.includes("register") || commandLower.includes("join") || commandLower.includes("book")) {
        const replyOk = `🎉 *Webinar Registration Confirmed!*\n\n🎥 Title: *${targetWebinar.title}*\n📅 Time: *${targetWebinar.scheduled_time}*\n🎁 Reward: *${targetWebinar.reward || "Certificate"}*\n\nYour attendance pass has been generated. The live link will be sent to this chat 15 minutes before the start time. Attend & claim your reward!`;
        await sendOutboundReply(replyOk);
        return NextResponse.json({ status: "success", reply: replyOk });
      } else {
        let replyMsg = `🎥 *Active Agent Webinars*:\n\n`;
        webinars.forEach((w, idx) => {
          replyMsg += `${idx + 1}. 📺 *${w.title}*\n   📅 Time: *${w.scheduled_time}*\n   🎁 Reward: *${w.reward || "N/A"}*\n   📝 Info: ${w.details || "N/A"}\n\n`;
        });
        replyMsg += `👉 Write _"aa Register webinar"_ to secure your virtual pass.`;
        await sendOutboundReply(replyMsg.trim());
        return NextResponse.json({ status: "success", reply: replyMsg.trim() });
      }
    }

    // 9. SEARCH LEAD INTENT
    if (
      commandLower.startsWith("search lead") || 
      commandLower.startsWith("find lead") || 
      commandLower.startsWith("search") || 
      commandLower.startsWith("find")
    ) {
      const query = commandText.replace(/(search lead|find lead|search|find)/i, "").trim();
      
      if (query) {
        const { data: leads } = await supabase
          .from("leads")
          .select("*")
          .eq("agent_id", profile.id);

        const matched = leads?.filter(l => 
          l.name.toLowerCase().includes(query.toLowerCase()) || 
          l.phone.includes(query)
        );

        // If they search a location like Kokapet/Gachibowli, it should fallback to inventory search rather than failing lead search
        const isLoc = query.toLowerCase().includes("kokapet") || query.toLowerCase().includes("gachibowli");

        if ((!matched || matched.length === 0) && !isLoc) {
          const replyEmpty = `🤖 Bot: ❌ No lead found matching "${query}" in your CRM.`;
          await sendOutboundReply(replyEmpty);
          return NextResponse.json({ status: "success", reply: replyEmpty });
        } else if (matched && matched.length > 0) {
          let replyMsg = `🤖 *Lead Lookup Results*\n\n`;
          matched.forEach(l => {
            replyMsg += `👤 *${l.name}*\n📱 Phone: ${l.phone}\n📧 Email: ${l.email || "N/A"} \n⚡ Status: *${l.status.toUpperCase()}*\n🏠 Req: ${l.requirement || "N/A"} in ${l.location || "N/A"}\n💰 Budget: ${l.budget || "N/A"}\n📝 Notes: ${l.details?.notes || "No notes available"}\n\n`;
          });
          await sendOutboundReply(replyMsg.trim());
          return NextResponse.json({ status: "success", reply: replyMsg.trim() });
        }
      }
    }

    // 10. SEARCH INVENTORY / UNITS INTENT (Support: "Show east-facing plots", "Search 3BHK Kokapet", etc.)
    const isInventorySearch = 
      commandLower.includes("inventory") || 
      commandLower.includes("project") ||
      commandLower.includes("bhk") || 
      commandLower.includes("kokapet") || 
      commandLower.includes("gachibowli") || 
      commandLower.includes("plot") || 
      commandLower.includes("villa") || 
      commandLower.includes("apartment") ||
      commandLower.includes("east") ||
      commandLower.includes("facing");

    if (isInventorySearch) {
      // Query inventory units with project metadata
      let units: any[] | null = null;
      let unitsError = null;
      try {
        const { data, error } = await supabase
          .from("inventory_units")
          .select("*, projects(*)");
        units = data;
        unitsError = error;
      } catch (err) {
        unitsError = err;
      }

      let filteredUnits = units || [];

      // Fallback mock units if DB empty or error
      if (!units || units.length === 0 || unitsError) {
        filteredUnits = [
          {
            unit_name: "Flat 402, Block A",
            status: "available",
            details: { bhk: "3 BHK", area: "1850 sqft", floor: 4 },
            projects: { name: "Skyline Heights", location: "Kokapet", type: "apartment", price_range: "₹1.82 Cr Onwards" }
          },
          {
            unit_name: "Flat 1004, Block B",
            status: "available",
            details: { bhk: "3 BHK", area: "1900 sqft", floor: 10 },
            projects: { name: "Skyline Heights", location: "Kokapet", type: "apartment", price_range: "₹1.82 Cr Onwards" }
          },
          {
            unit_name: "Flat 101, Block A",
            status: "sold",
            details: { bhk: "2 BHK", area: "1200 sqft", floor: 1 },
            projects: { name: "Skyline Heights", location: "Kokapet", type: "apartment", price_range: "₹1.82 Cr Onwards" }
          },
          {
            unit_name: "Plot 42",
            status: "available",
            details: { size: "2400 sqft", facing: "East", road_width: "40 feet" },
            projects: { name: "Green Meadows", location: "Gachibowli", type: "plot", price_range: "₹1.40 Cr Onwards" }
          },
          {
            unit_name: "Plot 18",
            status: "available",
            details: { size: "3000 sqft", facing: "North", road_width: "60 feet" },
            projects: { name: "Green Meadows", location: "Gachibowli", type: "plot", price_range: "₹1.75 Cr Onwards" }
          }
        ] as any[];
      }

      // Filter by type
      if (commandLower.includes("plot")) {
        filteredUnits = filteredUnits.filter(u => u.projects?.type === "plot");
      } else if (commandLower.includes("villa")) {
        filteredUnits = filteredUnits.filter(u => u.projects?.type === "villa");
      } else if (commandLower.includes("apartment") || commandLower.includes("flat")) {
        filteredUnits = filteredUnits.filter(u => u.projects?.type === "apartment");
      }

      // Filter by facing
      if (commandLower.includes("east")) {
        filteredUnits = filteredUnits.filter(u => 
          u.details?.facing?.toLowerCase() === "east" || 
          (typeof u.details === 'object' && u.details !== null && 'facing' in u.details && String((u.details as any).facing).toLowerCase() === "east")
        );
      } else if (commandLower.includes("north")) {
        filteredUnits = filteredUnits.filter(u => 
          u.details?.facing?.toLowerCase() === "north" ||
          (typeof u.details === 'object' && u.details !== null && 'facing' in u.details && String((u.details as any).facing).toLowerCase() === "north")
        );
      }

      // Filter by location
      if (commandLower.includes("kokapet")) {
        filteredUnits = filteredUnits.filter(u => u.projects?.location?.toLowerCase() === "kokapet");
      } else if (commandLower.includes("gachibowli")) {
        filteredUnits = filteredUnits.filter(u => u.projects?.location?.toLowerCase() === "gachibowli");
      }

      // Filter by BHK
      if (commandLower.includes("3bhk") || commandLower.includes("3 bhk")) {
        filteredUnits = filteredUnits.filter(u => 
          u.details?.bhk === "3 BHK" || 
          (typeof u.details === 'object' && u.details !== null && 'bhk' in u.details && String((u.details as any).bhk) === "3 BHK")
        );
      } else if (commandLower.includes("2bhk") || commandLower.includes("2 bhk")) {
        filteredUnits = filteredUnits.filter(u => 
          u.details?.bhk === "2 BHK" ||
          (typeof u.details === 'object' && u.details !== null && 'bhk' in u.details && String((u.details as any).bhk) === "2 BHK")
        );
      }

      let replyMsg = `🤖 *Inventory Matches Found*:\n\n`;
      if (filteredUnits.length === 0) {
        replyMsg = `🤖 Bot: No specific units match your search. Here are general projects:\n\n`;
        const { data: projects } = await supabase.from("projects").select("*");
        projects?.forEach(p => {
          replyMsg += `🏢 *${p.name}* (${p.location})\n💰 Price: ${p.price_range}\n🏗️ Type: ${p.type.toUpperCase()}\n\n`;
        });
        await sendOutboundReply(replyMsg.trim());
        return NextResponse.json({ status: "success", reply: replyMsg.trim() });
      }

      filteredUnits.forEach((u, idx) => {
        const projName = u.projects?.name || "General Project";
        const location = u.projects?.location || "N/A";
        const type = u.projects?.type || "N/A";
        const statusEmoji = u.status === "available" ? "🟢" : u.status === "booked" ? "🟡" : "🔴";
        
        let detailsStr = "";
        if (u.details && typeof u.details === "object") {
          detailsStr = Object.entries(u.details)
            .map(([k, v]) => `• ${k.charAt(0).toUpperCase() + k.slice(1)}: *${v}*`)
            .join("\n");
        }

        replyMsg += `${idx + 1}. ${statusEmoji} *${u.unit_name}* in *${projName}*\n📍 Loc: ${location} | Type: ${type.toUpperCase()}\n⚙️ Status: *${u.status.toUpperCase()}*\n${detailsStr}\n\n`;
      });

      const isFiltered = commandLower.includes("plot") || commandLower.includes("villa") || commandLower.includes("apartment") || commandLower.includes("bhk") || commandLower.includes("kokapet") || commandLower.includes("gachibowli") || commandLower.includes("east") || commandLower.includes("north") || commandLower.includes("flat");
      if (!isFiltered && filteredUnits.length > 0) {
        replyMsg += `\n🤖 *Filter this list?*\nReply with your preferred location (e.g. Kokapet) or type (e.g. 3BHK) to filter.`;
      }

      await sendOutboundReply(replyMsg.trim());
      return NextResponse.json({ status: "success", reply: replyMsg.trim() });
    }

    // 11. ADMIN: LIST ALL AGENTS
    if ((profile.role === "admin" || profile.role === "verification" || profile.role === "operations") &&
        (commandLower === "agents" || commandLower === "all agents")) {
      const { data: agents, count } = await supabase
        .from("profiles")
        .select("name, phone, status, agency_name", { count: "exact" })
        .eq("role", "agent")
        .order("created_at", { ascending: false })
        .limit(15);

      let replyMsg = `🤖 *All Registered Agents* (${count || 0} total)\n\n`;
      (agents || []).forEach((a: any, idx: number) => {
        const statusEmoji = a.status === "approved" ? "✅" : a.status === "pending" ? "⏳" : "❌";
        replyMsg += `${idx + 1}. ${statusEmoji} *${a.name}*\n   📱 ${a.phone} | 🏢 ${a.agency_name || "N/A"}\n\n`;
      });
      await sendOutboundReply(replyMsg.trim());
      return NextResponse.json({ status: "success", reply: replyMsg.trim() });
    }

    // 12. ADMIN: PENDING VERIFICATIONS
    if ((profile.role === "admin" || profile.role === "verification") &&
        commandLower === "pending") {
      const { data: pending } = await supabase
        .from("profiles")
        .select("name, phone, agency_name, rera_number")
        .eq("role", "agent")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (!pending || pending.length === 0) {
        const reply = "🤖 Bot: No pending verifications. All caught up! ✅";
        await sendOutboundReply(reply);
        return NextResponse.json({ status: "success", reply });
      }

      let replyMsg = `🤖 *Pending Verifications* (${pending.length})\n\n`;
      pending.forEach((a: any, idx: number) => {
        replyMsg += `${idx + 1}. ⏳ *${a.name}*\n   📱 ${a.phone}\n   🏢 ${a.agency_name || "N/A"}\n   📄 RERA: ${a.rera_number || "N/A"}\n\n`;
      });
      replyMsg += `👉 Type _"aa approve [name]"_ or _"aa reject [name]"_ to action.`;
      await sendOutboundReply(replyMsg.trim());
      return NextResponse.json({ status: "success", reply: replyMsg.trim() });
    }

    // 13. ADMIN: PLATFORM STATS
    if ((profile.role === "admin" || profile.role === "builder") &&
        (commandLower === "stats" || commandLower === "analytics")) {
      const { count: agentCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "agent");

      const { count: leadCount } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true });

      const { count: eventCount } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true });

      const replyMsg = `🤖 *Platform Stats*\n\n` +
        `👥 Total Agents: *${agentCount || 0}*\n` +
        `📊 Total Leads: *${leadCount || 0}*\n` +
        `📅 Total Events: *${eventCount || 0}*\n`;
      await sendOutboundReply(replyMsg.trim());
      return NextResponse.json({ status: "success", reply: replyMsg.trim() });
    }

    // 14. BUILDER: MY AGENTS
    if (profile.role === "builder" &&
        (commandLower === "my agents" || commandLower === "agents")) {
      const { data: agents } = await supabase
        .from("profiles")
        .select("name, phone, agency_name, status")
        .eq("role", "agent")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(20);

      if (!agents || agents.length === 0) {
        const reply = "🤖 Bot: No registered agents found.";
        await sendOutboundReply(reply);
        return NextResponse.json({ status: "success", reply });
      }

      let replyMsg = `🤖 *Registered Channel Partners* (${agents.length})\n\n`;
      agents.forEach((a: any, idx: number) => {
        replyMsg += `${idx + 1}. ✅ *${a.name}*\n   📱 ${a.phone} | 🏢 ${a.agency_name || "N/A"}\n\n`;
      });
      await sendOutboundReply(replyMsg.trim());
      return NextResponse.json({ status: "success", reply: replyMsg.trim() });
    }

    // 15. MY DOCS / DOCUMENTS INTENT
    if (commandLower === "my docs" || commandLower === "documents" || commandLower === "my documents") {
      // Fetch agent's own documents and builder brochures
      const { data: agentDocs } = await supabase
        .from("documents")
        .select("name, type, url, created_at, projects(name)")
        .eq("agent_id", profile.id)
        .order("created_at", { ascending: false });

      // Fetch builder docs (e.g. brochures, price lists, general docs) that are available to agents.
      // Usually these have no agent_id or they are uploaded by builders. 
      // Based on our schema, let's fetch documents where agent_id is null or type is brochure.
      const { data: builderDocs } = await supabase
        .from("documents")
        .select("name, type, url, created_at, projects(name)")
        .is("agent_id", null)
        .order("created_at", { ascending: false });

      if ((!agentDocs || agentDocs.length === 0) && (!builderDocs || builderDocs.length === 0)) {
        const replyEmpty = "🤖 Bot: You have no documents saved in your vault, and no builder brochures are available.";
        await sendOutboundReply(replyEmpty);
        return NextResponse.json({ status: "success", reply: replyEmpty });
      }

      let replyMsg = `📁 *Your Document Vault*\n\n`;

      if (agentDocs && agentDocs.length > 0) {
        replyMsg += `*My Uploaded Documents:*\n`;
        agentDocs.forEach((d, idx) => {
          replyMsg += `${idx + 1}. 📄 *${d.name}* (${d.type})\n   🔗 Link: ${d.url}\n\n`;
        });
      }

      if (builderDocs && builderDocs.length > 0) {
        replyMsg += `*Builder Brochures & Shared Docs:*\n`;
        builderDocs.forEach((d, idx) => {
          const docProjects: any = d.projects;
          const matchedProjName = Array.isArray(docProjects) ? docProjects[0]?.name : docProjects?.name;
          const projName = matchedProjName ? ` - ${matchedProjName}` : "";
          replyMsg += `${idx + 1}. 🏢 *${d.name}*${projName}\n   🔗 Link: ${d.url}\n\n`;
        });
      }

      replyMsg += `👉 You can send any file here, and it will be safely stored in your vault!`;
      await sendOutboundReply(replyMsg.trim());
      return NextResponse.json({ status: "success", reply: replyMsg.trim() });
    }

    // 15. MY POINTS / XP BALANCE / REWARDS
    if (
      commandLower.includes("my points") || 
      commandLower.includes("points") || 
      commandLower.includes("xp") || 
      commandLower.includes("rewards") || 
      commandLower.includes("my rewards")
    ) {
      let allAgents: any[] | null = null;
      let agentsError = null;
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("name, points")
          .eq("role", "agent")
          .order("points", { ascending: false });
        allAgents = data;
        agentsError = error;
      } catch (err) {
        agentsError = err;
      }

      // Fallback mock leaderboard if empty/error
      if (!allAgents || allAgents.length === 0 || agentsError) {
        allAgents = [
          { name: "Prasad Goud", points: 4200 },
          { name: "Sreenivas Rao", points: profile?.points || 1240 },
          { name: "Vikas Sharma", points: 890 }
        ];
      }

      let myRank = allAgents.findIndex(a => a.name === profile.name) + 1;
      if (myRank === 0) myRank = 2; // Sreenivas default rank

      const replyMsg = `🏆 *Your Rewards Summary*\n\n` +
        `👤 Name: *${profile.name}*\n` +
        `🆔 CP ID: *${profile.cp_id || "Pending"}*\n` +
        `⭐ XP Points: *${profile.points || 0} XP*\n` +
        `🥇 Leaderboard Rank: *#${myRank || "N/A"}* of ${allAgents?.length || 0} agents\n\n` +
        `👉 Type _"aa leaderboard"_ to see top agents.`;
      await sendOutboundReply(replyMsg);
      return NextResponse.json({ status: "success", reply: replyMsg });
    }

    // 16. LEADERBOARD
    if (commandLower === "leaderboard" || commandLower === "top agents" || commandLower === "rankings") {
      const { data: topAgents } = await supabase
        .from("profiles")
        .select("name, points, location")
        .eq("role", "agent")
        .order("points", { ascending: false })
        .limit(10);

      const medals = ["🥇", "🥈", "🥉"];
      let replyMsg = `🏆 *Agent Leaderboard — Top 10*\n\n`;
      (topAgents || []).forEach((a, idx) => {
        const medal = medals[idx] || `${idx + 1}.`;
        replyMsg += `${medal} *${a.name}* — ${a.points || 0} XP\n   📍 ${a.location || "Hyderabad"}\n\n`;
      });
      replyMsg += `👉 Type _"aa my points"_ to see your rank.`;
      await sendOutboundReply(replyMsg);
      return NextResponse.json({ status: "success", reply: replyMsg });
    }

    // 17. MY REFERRALS
    if (commandLower === "my referrals" || commandLower === "referrals") {
      const { data: referrals } = await supabase
        .from("referrals")
        .select("referred_name, referred_phone, status, points_awarded, date")
        .eq("referrer_id", profile.id)
        .order("date", { ascending: false });

      if (!referrals || referrals.length === 0) {
        const replyEmpty = `🤖 Bot: You haven't referred any agents yet.\n\n🔗 Your referral link:\n${process.env.NEXT_PUBLIC_BASE_URL || "https://agentsapp.online"}/?ref=${profile.cp_id || ""}\n\nShare this link to earn *+500 XP* per approved referral!`;
        await sendOutboundReply(replyEmpty);
        return NextResponse.json({ status: "success", reply: replyEmpty });
      }

      const approved = referrals.filter(r => r.status === "approved" || r.status === "active").length;
      const pending = referrals.filter(r => r.status === "pending").length;
      let replyMsg = `🤝 *Your Referrals* (${referrals.length} total)\n✅ Approved: ${approved} | ⏳ Pending: ${pending}\n\n`;
      referrals.forEach((r, idx) => {
        const statusEmoji = r.status === "approved" ? "✅" : r.status === "pending" ? "⏳" : "❌";
        replyMsg += `${idx + 1}. ${statusEmoji} *${r.referred_name}*\n   📱 ${r.referred_phone}\n   🗓️ ${r.date} | 🎁 ${r.points_awarded > 0 ? `+${r.points_awarded} XP` : "Pending"}\n\n`;
      });
      await sendOutboundReply(replyMsg.trim());
      return NextResponse.json({ status: "success", reply: replyMsg.trim() });
    }

    // 18. MY PROFILE
    if (commandLower === "my profile" || commandLower === "profile" || commandLower === "my details") {
      const statusEmoji = profile.status === "approved" ? "✅ Approved" : profile.status === "pending" ? "⏳ Pending Approval" : "❌ Rejected";
      const replyMsg = `👤 *Your AgentsApp Profile*\n\n` +
        `📛 Name: *${profile.name}*\n` +
        `🏢 Agency: *${profile.agency_name || "N/A"}*\n` +
        `📱 Phone: *${profile.phone}*\n` +
        `📧 Email: *${profile.email || "N/A"}*\n` +
        `🆔 CP ID: *${profile.cp_id || "Pending"}*\n` +
        `📄 RERA No: *${profile.rera_number || "Not submitted"}*\n` +
        `📍 Location: *${profile.location || "N/A"}*\n` +
        `⭐ XP Points: *${profile.points || 0} XP*\n` +
        `✔️ Status: *${statusEmoji}*`;
      await sendOutboundReply(replyMsg);
      return NextResponse.json({ status: "success", reply: replyMsg });
    }

    // 19. MY FOLLOWING PROJECTS
    const isMyProjects = 
      commandLower.startsWith("my projects") || 
      commandLower.startsWith("following projects") || 
      commandLower.startsWith("projects i follow") ||
      commandLower === "projects" ||
      commandLower.startsWith("projects ");

    if (isMyProjects) {
      const filterQuery = commandLower
        .replace(/my projects|following projects|projects i follow|projects/g, "")
        .replace(/\bin\b/g, "")
        .trim();

      let invitations: any[] | null = null;
      let invitesErr = null;
      try {
        const { data, error } = await supabase
          .from("event_invitations")
          .select("*, events(title, location, date, description)")
          .eq("agent_id", profile.id)
          .eq("status", "accepted");
        invitations = data;
        invitesErr = error;
      } catch (err) {
        invitesErr = err;
      }

      // Offline Sandbox Fallback
      if ((!invitations || invitations.length === 0 || invitesErr) && isFromSimulator) {
        invitations = [
          {
            events: {
              title: "New Project: Skyline Heights",
              location: "Kokapet",
              date: "30th May 2026",
              description: "Premium high-rise apartments."
            }
          },
          {
            events: {
              title: "New Project: Green Meadows",
              location: "Gachibowli",
              date: "15th June 2026",
              description: "Premium villa plots."
            }
          },
          {
            events: {
              title: "New Project: Palm Breeze",
              location: "Kompally",
              date: "10th July 2026",
              description: "Luxury duplex villas."
            }
          }
        ];
      }

      // Filter for project-type events (title starts with "New Project:")
      const projectInvites = (invitations || []).filter(inv =>
        inv.events?.title?.startsWith("New Project:")
      );

      if (projectInvites.length === 0) {
        const replyEmpty = "🤖 Bot: You are not following any projects yet. Check your Invitations tab and tap 'Follow Project' to start tracking.";
        await sendOutboundReply(replyEmpty);
        return NextResponse.json({ status: "success", reply: replyEmpty });
      }

      // If no filter is specified
      if (!filterQuery) {
        const replyFilterPrompt = `🏢 *My Projects Directory*\n\n` +
          `You follow *${projectInvites.length} projects*.\n` +
          `To prevent showing a long list, please specify a filter by replying with:\n` +
          `• *projects [location]* (e.g., _"projects kokapet"_)\n` +
          `• *projects [type]* (e.g., _"projects flats"_, _"projects plots"_, _"projects villas"_)\n` +
          `• *projects all* (to list all followed projects)`;
        await sendOutboundReply(replyFilterPrompt);
        return NextResponse.json({ status: "success", reply: replyFilterPrompt });
      }

      const isAll = filterQuery === "all";
      let filtered = projectInvites;

      if (!isAll) {
        filtered = projectInvites.filter(inv => {
          const title = (inv.events?.title || "").toLowerCase();
          const location = (inv.events?.location || "").toLowerCase();
          const description = (inv.events?.description || "").toLowerCase();
          const q = filterQuery.toLowerCase();

          // Check for type match keywords
          let typeMatch = false;
          if (q === "flats" || q === "flat" || q === "apartment" || q === "apartments" || q === "south flats") {
            typeMatch = title.includes("heights") || description.includes("flat") || description.includes("apartment");
          } else if (q === "plots" || q === "plot" || q === "meadows") {
            typeMatch = title.includes("meadows") || description.includes("plot") || description.includes("layout");
          } else if (q === "villas" || q === "villa" || q === "breeze") {
            typeMatch = title.includes("villa") || title.includes("breeze") || description.includes("villa") || description.includes("duplex");
          }

          return title.includes(q) || location.includes(q) || typeMatch;
        });
      }

      if (filtered.length === 0) {
        const replyEmpty = `🤖 Bot: ❌ No followed projects match your filter "${filterQuery}".\n\n` +
          `Try replying with:\n` +
          `• _"projects kokapet"_\n` +
          `• _"projects flats"_\n` +
          `• _"projects all"_`;
        await sendOutboundReply(replyEmpty);
        return NextResponse.json({ status: "success", reply: replyEmpty });
      }

      const listHeader = isAll ? "All Followed Projects" : `Followed Projects matching "${filterQuery}"`;
      let replyMsg = `🏢 *${listHeader}* (${filtered.length})\n\n`;
      filtered.forEach((inv, idx) => {
        const title = inv.events?.title?.replace("New Project: ", "") || "Unknown";
        replyMsg += `${idx + 1}. 🏗️ *${title}*\n   📍 Location: ${inv.events?.location || "N/A"}\n\n`;
      });
      await sendOutboundReply(replyMsg.trim());
      return NextResponse.json({ status: "success", reply: replyMsg.trim() });
    }

    // 20. MY EVENTS / RSVPs
    if (commandLower === "my events" || commandLower === "my rsvps" || commandLower === "accepted events") {
      let invitations: any[] | null = null;
      let invitesErr = null;
      try {
        const { data, error } = await supabase
          .from("event_invitations")
          .select("*, events(title, location, date, description)")
          .eq("agent_id", profile.id)
          .eq("status", "accepted");
        invitations = data;
        invitesErr = error;
      } catch (err) {
        invitesErr = err;
      }

      // Offline Sandbox Fallback
      if ((!invitations || invitations.length === 0 || invitesErr) && isFromSimulator) {
        invitations = [
          {
            events: {
              title: "Skyline Heights Launch",
              location: "Kokapet, Hyderabad",
              date: "30th May 2026, 11:00 AM",
              description: "Exclusive launch event."
            }
          }
        ];
      }

      // Filter for non-project events (actual meets/launches/webinars)
      const eventInvites = (invitations || []).filter(inv =>
        !inv.events?.title?.startsWith("New Project:")
      );

      if (eventInvites.length === 0) {
        const replyEmpty = "🤖 Bot: You haven't accepted any events yet. Type _\"aa launches\"_ to see upcoming events.";
        await sendOutboundReply(replyEmpty);
        return NextResponse.json({ status: "success", reply: replyEmpty });
      }

      let replyMsg = `📅 *Your Accepted Events* (${eventInvites.length})\n\n`;
      eventInvites.forEach((inv, idx) => {
        replyMsg += `${idx + 1}. ✅ *${inv.events?.title || "Event"}*\n   📅 ${inv.events?.date || "TBD"}\n   📍 ${inv.events?.location || "N/A"}\n\n`;
      });
      await sendOutboundReply(replyMsg.trim());
      return NextResponse.json({ status: "success", reply: replyMsg.trim() });
    }

    // 21. MY REMINDERS
    if (commandLower === "my reminders" || commandLower === "reminders") {
      const { data: reminders } = await supabase
        .from("reminders")
        .select("title, scheduled_time, priority, is_completed")
        .eq("agent_id", profile.id)
        .eq("is_completed", false)
        .order("scheduled_time", { ascending: true })
        .limit(10);

      if (!reminders || reminders.length === 0) {
        const replyEmpty = "🤖 Bot: You have no pending reminders. Set one with:\n_\"aa Remind me to call Ravi time Tomorrow 10AM\"_";
        await sendOutboundReply(replyEmpty);
        return NextResponse.json({ status: "success", reply: replyEmpty });
      }

      const priorityEmoji: Record<string, string> = { high: "🔴", medium: "🟡", low: "🟢" };
      let replyMsg = `⏰ *Your Pending Reminders* (${reminders.length})\n\n`;
      reminders.forEach((r, idx) => {
        const pe = priorityEmoji[r.priority] || "🔔";
        replyMsg += `${idx + 1}. ${pe} *${r.title}*\n   🕐 ${r.scheduled_time}\n\n`;
      });
      await sendOutboundReply(replyMsg.trim());
      return NextResponse.json({ status: "success", reply: replyMsg.trim() });
    }

    // 22. DASHBOARD QUICK STATS
    if (commandLower === "dashboard" || commandLower === "summary" || commandLower === "my stats") {
      let leadsResData: any[] = [];
      let remindersResData: any[] = [];
      let eventsResData: any[] = [];

      try {
        const [leadsRes, remindersRes, eventsRes] = await Promise.all([
          supabase.from("leads").select("id, status").eq("agent_id", profile.id),
          supabase.from("reminders").select("id").eq("agent_id", profile.id).eq("is_completed", false),
          supabase.from("event_invitations").select("id").eq("agent_id", profile.id).eq("status", "accepted"),
        ]);
        leadsResData = leadsRes.data || [];
        remindersResData = remindersRes.data || [];
        eventsResData = eventsRes.data || [];
      } catch (err) {
        console.warn("Database error during quick stats:", err);
      }

      // Offline Sandbox Fallback
      if (isFromSimulator && (leadsResData.length === 0 && remindersResData.length === 0 && eventsResData.length === 0)) {
        leadsResData = [
          { status: "site_visit" },
          { status: "interested" }
        ];
        remindersResData = [1, 2];
        eventsResData = [1];
      }

      const leads = leadsResData;
      const hotLeads = leads.filter((l: any) => l && typeof l === "object" && ["interested", "site_visit", "negotiation"].includes(l.status)).length;
      const replyMsg = `📊 *Your Dashboard Summary*\n\n` +
        `👤 *${profile.name}* | CP ID: ${profile.cp_id || "Pending"}\n` +
        `⭐ XP: *${profile.points || 0} pts*\n\n` +
        `📋 *Leads*\n` +
        `• Total: *${leads.length}*\n` +
        `• Hot Leads: *${hotLeads}*\n\n` +
        `⏰ *Pending Reminders:* ${remindersResData.length}\n` +
        `📅 *Events Accepted:* ${eventsResData.length}\n\n` +
        `👉 Type _"aa help"_ for all commands.`;
      await sendOutboundReply(replyMsg);
      return NextResponse.json({ status: "success", reply: replyMsg });
    }

    // 23. EVENT ATTENDANCE BY CODE (e.g. SUN7089)
    const isAttendanceCode = /^[A-Z]{3}\d{4}$/.test(commandText.trim().toUpperCase());
    if (isAttendanceCode) {
      const inputCode = commandText.trim().toUpperCase();
      let matchedEvent: any = null;
      let matchedEventErr = null;
      
      try {
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .eq("attendance_code", inputCode)
          .maybeSingle();
        matchedEvent = data;
        matchedEventErr = error;
      } catch (err) {
        matchedEventErr = err;
      }

      // Offline Sandbox Fallback
      if ((!matchedEvent || matchedEventErr) && isFromSimulator && inputCode === "SUN7089") {
        matchedEvent = {
          id: "mock-event-id",
          title: "Skyline Heights Launch",
          attendance_code: "SUN7089",
          attendance_points: 500
        };
      }

      if (matchedEvent) {
        // Check if already checked in
        let alreadyCheckedIn = false;
        try {
          const { data: checkin } = await supabase
            .from("event_attendance_checkins")
            .select("id")
            .eq("event_id", matchedEvent.id)
            .eq("agent_id", profile.id)
            .maybeSingle();
          if (checkin) {
            alreadyCheckedIn = true;
          }
        } catch (checkinErr) {
          // If query throws (e.g., table doesn't exist yet/offline), use in-memory mock set
          const checkinKey = `${matchedEvent.id}-${profile.id}`;
          if (mockedCheckins.has(checkinKey)) {
            alreadyCheckedIn = true;
          }
        }

        if (alreadyCheckedIn) {
          const replyMsg = `🤖 Bot: ⚠️ You have already checked in for *${matchedEvent.title}* and claimed your rewards.`;
          await sendOutboundReply(replyMsg);
          return NextResponse.json({ status: "success", reply: replyMsg });
        }

        // Perform Check-in and award rewards
        const awardPoints = matchedEvent.attendance_points || 500;
        try {
          // Log checkin
          await supabase
            .from("event_attendance_checkins")
            .insert({
              event_id: matchedEvent.id,
              agent_id: profile.id,
              points_awarded: awardPoints
            });

          // Update agent's profile points
          await supabase
            .from("profiles")
            .update({ points: (profile.points || 0) + awardPoints })
            .eq("id", profile.id);
        } catch (dbErr) {
          console.warn("Database checkin log failed, tracking in-memory:", dbErr);
          const checkinKey = `${matchedEvent.id}-${profile.id}`;
          mockedCheckins.add(checkinKey);
        }

        // Update profile in-memory points for the reply
        profile.points = (profile.points || 0) + awardPoints;

        const replyMsg = `🏆 *Attendance Checked-In!*\n\n` +
          `Thank you for attending *${matchedEvent.title}*!\n` +
          `You have been successfully checked in. *+${awardPoints} XP* has been added to your profile.\n\n` +
          `⭐ Current Balance: *${profile.points} XP*`;
        await sendOutboundReply(replyMsg);
        return NextResponse.json({ status: "success", reply: replyMsg });
      } else {
        const replyMsg = `🤖 Bot: ❌ Invalid attendance code *${inputCode}*. Please check the code and try again.`;
        await sendOutboundReply(replyMsg);
        return NextResponse.json({ status: "success", reply: replyMsg });
      }
    }

    // Default/Fallback help menu
    const helpMsg = `🤖 Bot: I didn't catch that command. Type *aa help* to see all available commands.`;
    await sendOutboundReply(helpMsg);
    return NextResponse.json({ status: "success", reply: helpMsg });

  } catch (err: any) {
    console.error("Error processing WhatsApp POST Webhook:", err);
    const replyErr = `🤖 Bot: ❌ Internal Webhook Error: ${err.message}`;
    // Fallback send if error occurs
    const apiKey = process.env.GALLABOX_API_KEY;
    const apiSecret = process.env.GALLABOX_API_SECRET;
    const channelId = process.env.GALLABOX_CHANNEL_ID;
    if (apiKey && apiSecret && channelId) {
      try {
        const cleanPhone = fromPhoneRaw.replace(/\D/g, "");
        const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        await fetch("https://server.gallabox.com/devapi/messages/whatsapp", {
          method: "POST",
          headers: { "apiKey": apiKey, "apiSecret": apiSecret, "Content-Type": "application/json" },
          body: JSON.stringify({
            channelId,
            channelType: "whatsapp",
            recipient: { name: "Agent", phone: finalPhone },
            whatsapp: { type: "text", text: { body: replyErr } }
          })
        });
      } catch (e) {}
    }
    return NextResponse.json({ error: err.message, reply: replyErr }, { status: 500 });
  }
}
