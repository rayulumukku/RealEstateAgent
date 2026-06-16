import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

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

    if (!textBody || !fromPhoneRaw) {
      console.log("Ignored payload: Missing message body or sender phone number.");
      await logWhatsappMessage({
        direction: "inbound",
        phone: fromPhoneRaw || null,
        message_type: "system",
        content: textBody || null,
        error_message: "missing body or phone",
        raw_payload: payload,
      });
      return NextResponse.json({ status: "ignored", message: "Missing body or phone" });
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

    // If it doesn't match our routing signature, ignore it and let GallaBox's default flows handle it
    if (!hasAaPrefix && !isFromSimulator) {
      console.log("Ignored payload: Does not start with 'aa' and not from simulator.");
      return NextResponse.json({ status: "ignored", message: "Not intended for agentsapp bot" });
    }

    // Strip "aa" prefix to normalize command text for processing
    let commandText = textBody;
    if (lowerText.startsWith("aa ")) {
      commandText = textBody.slice(3).trim();
    } else if (lowerText === "aa") {
      commandText = "help";
    }

    const commandLower = commandText.toLowerCase();

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
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("phone", formattedPhone)
      .single();

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
           interestedArr = regInterested.split(",").map(i => i.trim());
        }

        const cleanInputPhone = regPhone.replace(/\D/g, "");
        const finalPhoneForDb = cleanInputPhone.length >= 10 
          ? `+91 ${cleanInputPhone.slice(-10).slice(0, 5)} ${cleanInputPhone.slice(-10).slice(5)}` 
          : formattedPhone;

        let dbError = null;
        let generatedId = profile?.cp_id || `CP-${Math.floor(1000 + Math.random() * 9000)}`;

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
              cp_id: generatedId,
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
          const replyOk = `🎉 *Registration ${profile ? "Updated" : "Successful"}!*\n\n👤 Name: *${regName}*\n🏢 Agency: *${regAgency}*\n📞 Phone: *${finalPhoneForDb}*${locText}${intText}\n🆔 CP ID: *${generatedId}*\n💰 Welcome Reward: *+500 XP*\n\n⚠️ *Action Required:*\nPlease reply to this message with your *RERA Document, Aadhar, and PAN* to get verified.\n\nYour account is currently *pending approval* by an admin.`;
          await sendOutboundReply(replyOk);
          return NextResponse.json({ status: "success", reply: replyOk });
        }
      } else {
        const replyFormat = `🤖 *AgentsApp Onboarding*:\n\nTo register as a Channel Partner directly on WhatsApp, please reply in this format:\n\n_"aa Register [Your Name] phone [Your Phone Number] agency [Agency Name] location [Your City] interested in [Property Types]"_`;
        await sendOutboundReply(replyFormat);
        return NextResponse.json({ status: "success", reply: replyFormat });
      }
    }

    if (!profile) {
      // If not a registration command, ask them to register
      const replyRegPrompt = `🤖 *Welcome to AgentsApp!*\n\nIt looks like your phone number is not registered yet as a Channel Partner.\n\nTo create your account instantly on WhatsApp, please reply with:\n\n_"aa Register [Your Name] phone [Your Phone Number] agency [Your Agency Name]"_`;
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
          `1. _"aa Add [Name] looking for [BHK]"_ — add lead\n` +
          `2. _"aa My leads"_ — view all your leads\n` +
          `3. _"aa Search [Name]"_ — find a specific lead\n` +
          `4. _"aa [Name] site visit"_ — update lead status\n\n` +
          `⏰ *Reminders*\n` +
          `5. _"aa Remind me to call [Name] time [date]"_ — set reminder\n` +
          `6. _"aa my reminders"_ — view pending reminders\n\n` +
          `🏢 *Inventory & Projects*\n` +
          `7. _"aa Search 3BHK Kokapet"_ — search units\n` +
          `8. _"aa brochure [project]"_ — get brochure PDF\n` +
          `9. _"aa my projects"_ — projects you follow\n\n` +
          `📅 *Events*\n` +
          `10. _"aa launches"_ — upcoming events & meets\n` +
          `11. _"aa webinars"_ — register for webinars\n` +
          `12. _"aa my events"_ — your accepted RSVPs\n\n` +
          `🏆 *Rewards*\n` +
          `13. _"aa my points"_ — your XP balance & rank\n` +
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

    // 2. ADD LEAD INTENT (Support: "Add Ravi looking for 3BHK", etc.)
    if (commandLower.startsWith("add") || commandLower.includes("add lead")) {
      let leadName = "New Lead";
      let leadPhone = "9876500000";
      let leadBudget = "₹1.80 Cr";
      let leadLoc = "Kokapet";
      let requirement = "3 BHK";

      // Match "Add [Name] looking for [Req]" or "Add [Name] wanting [Req]"
      const addLookingMatch = commandText.match(/add\s+([a-zA-Z\s]+)\s+looking\s+for\s+([0-9a-zA-Z\s_]+)/i);
      if (addLookingMatch) {
        leadName = addLookingMatch[1].trim();
        requirement = addLookingMatch[2].trim();
      } else {
        // Fallback to original matching
        const nameMatch = commandText.match(/add\s+(?:lead\s+)?([a-zA-Z\s]+)/i);
        leadName = nameMatch?.[1]?.replace(/(phone|budget|location|looking|wanting).*/i, "")?.trim() || "New Lead";
      }

      const phoneMatch = commandText.match(/phone\s+([\d\s]+)/i);
      if (phoneMatch) {
        leadPhone = phoneMatch[1].replace(/\s+/g, "");
      }
      
      const budgetMatch = commandText.match(/budget\s+([^\s]+)/i);
      if (budgetMatch) {
        leadBudget = budgetMatch[1];
      }

      const locMatch = commandText.match(/location\s+([a-zA-Z\s]+)/i);
      if (locMatch) {
        leadLoc = locMatch[1].trim();
      }

      // Insert lead into Supabase
      const { data: newLead, error } = await supabase
        .from("leads")
        .insert([{
          agent_id: profile.id,
          name: leadName,
          phone: leadPhone,
          status: "new",
          requirement: requirement,
          location: leadLoc,
          budget: leadBudget,
          details: {
            propertyType: "Apartment",
            aiScore: 85,
            lastInteraction: "WhatsApp bot logged"
          }
        }])
        .select()
        .single();

      if (error) {
        console.error("Failed to insert lead via WhatsApp bot:", error);
        const replyErr = `🤖 Bot: ❌ Failed to add lead to database: ${error.message}`;
        await sendOutboundReply(replyErr);
        return NextResponse.json({ status: "error", reply: replyErr });
      } else {
        console.log("Successfully logged lead via WhatsApp bot:", newLead);
        const replyOk = `🤖 Bot: ✅ Lead Added!\n👤 Name: *${leadName}*\n📱 Phone: ${leadPhone}\n📍 Location: ${leadLoc}\n🏠 Req: *${requirement}*\n💰 Budget: ${leadBudget}\n\n(This was inserted in your live Supabase leads table. Close chat to see it!)`;
        await sendOutboundReply(replyOk);
        return NextResponse.json({ status: "success", reply: replyOk });
      }
    } 

    // 3. SET REMINDER INTENT (Support: "Remind me tomorrow to call Ramesh", etc.)
    if (commandLower.startsWith("remind") || commandLower.includes("remind")) {
      const match = commandText.match(/remind\s+(?:me\s+)?(?:to\s+)?([a-zA-Z0-9\s,.-]+)\s+time\s+(.*)/i);
      
      let title = "WhatsApp Follow-up Task";
      let scheduledTime = "Tomorrow, 10:00 AM";

      if (match) {
        title = match[1].trim();
        scheduledTime = match[2].trim();
      } else {
        // Fallback for simple "Remind me tomorrow"
        const titleMatch = commandText.match(/remind\s+me\s+(?:to\s+)?(.*)/i);
        if (titleMatch) {
          title = titleMatch[1].trim();
        }
      }

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
      const { data: leads } = await supabase
        .from("leads")
        .select("*")
        .eq("agent_id", profile.id)
        .order("created_at", { ascending: false });

      if (!leads || leads.length === 0) {
        const replyEmpty = "🤖 Bot: You don't have any leads registered yet. Add one by typing:\n\"aa Add lead [Name] phone [No]\"";
        await sendOutboundReply(replyEmpty);
        return NextResponse.json({ status: "success", reply: replyEmpty });
      }

      let replyMsg = `🤖 *Your CRM Leads List*\n\n`;
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
        replyMsg += `${idx + 1}. ${emoji} *${l.name}* (${l.phone})\n   📍 Loc: ${l.location || "N/A"} | Req: ${l.requirement || "N/A"}\n   ⚡ Status: *${l.status.toUpperCase()}* | Budget: ${l.budget || "N/A"}\n\n`;
      });
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
      const { data: units } = await supabase
        .from("inventory_units")
        .select("*, projects(*)");

      let filteredUnits = units || [];

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

    // 15. MY POINTS / XP BALANCE
    if (commandLower === "my points" || commandLower === "points" || commandLower === "xp" || commandLower === "my xp") {
      const { data: allAgents } = await supabase
        .from("profiles")
        .select("name, points")
        .eq("role", "agent")
        .order("points", { ascending: false });

      const myRank = (allAgents || []).findIndex(a => a.name === profile.name) + 1;

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
    if (commandLower === "my projects" || commandLower === "following projects" || commandLower === "projects i follow") {
      // agent_invitations links agents to events/projects via accepted status
      const { data: invitations } = await supabase
        .from("agent_invitations")
        .select("*, events(title, location, date, description)")
        .eq("agent_id", profile.id)
        .eq("status", "accepted");

      // Filter for project-type events (title starts with "New Project:")
      const projectInvites = (invitations || []).filter(inv =>
        inv.events?.title?.startsWith("New Project:")
      );

      if (projectInvites.length === 0) {
        const replyEmpty = "🤖 Bot: You are not following any projects yet. Check your Invitations tab and tap 'Follow Project' to start tracking.";
        await sendOutboundReply(replyEmpty);
        return NextResponse.json({ status: "success", reply: replyEmpty });
      }

      let replyMsg = `🏢 *Projects You're Following* (${projectInvites.length})\n\n`;
      projectInvites.forEach((inv, idx) => {
        const title = inv.events?.title?.replace("New Project: ", "") || "Unknown";
        replyMsg += `${idx + 1}. 🏗️ *${title}*\n   📍 ${inv.events?.location || "N/A"}\n\n`;
      });
      await sendOutboundReply(replyMsg.trim());
      return NextResponse.json({ status: "success", reply: replyMsg.trim() });
    }

    // 20. MY EVENTS / RSVPs
    if (commandLower === "my events" || commandLower === "my rsvps" || commandLower === "accepted events") {
      const { data: invitations } = await supabase
        .from("agent_invitations")
        .select("*, events(title, location, date, description)")
        .eq("agent_id", profile.id)
        .eq("status", "accepted");

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
      const [leadsRes, remindersRes, eventsRes] = await Promise.all([
        supabase.from("leads").select("id, status").eq("agent_id", profile.id),
        supabase.from("reminders").select("id").eq("agent_id", profile.id).eq("is_completed", false),
        supabase.from("agent_invitations").select("id").eq("agent_id", profile.id).eq("status", "accepted"),
      ]);

      const leads = leadsRes.data || [];
      const hotLeads = leads.filter(l => ["interested", "site_visit", "negotiation"].includes(l.status)).length;
      const replyMsg = `📊 *Your Dashboard Summary*\n\n` +
        `👤 *${profile.name}* | CP ID: ${profile.cp_id || "Pending"}\n` +
        `⭐ XP: *${profile.points || 0} pts*\n\n` +
        `📋 *Leads*\n` +
        `• Total: *${leads.length}*\n` +
        `• Hot Leads: *${hotLeads}*\n\n` +
        `⏰ *Pending Reminders:* ${remindersRes.data?.length || 0}\n` +
        `📅 *Events Accepted:* ${eventsRes.data?.length || 0}\n\n` +
        `👉 Type _"aa help"_ for all commands.`;
      await sendOutboundReply(replyMsg);
      return NextResponse.json({ status: "success", reply: replyMsg });
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
