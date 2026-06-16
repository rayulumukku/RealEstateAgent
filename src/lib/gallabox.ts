// -----------------------------------------------------------------------------
// Thin wrapper around GallaBox's outbound WhatsApp text endpoint.
//
// Used by:
//   - /api/whatsapp/webhook  → bot replies
//   - /auth/actions          → OTP delivery
// -----------------------------------------------------------------------------

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface GallaBoxSendResult {
  ok: boolean;
  status: number | null;
  responseBody: unknown;
  error?: string;
}

/**
 * Send a plain-text WhatsApp message to a phone via GallaBox.
 *
 * `rawPhone` may be in any format — digits, "+91 …", "+91-…". Whatever is
 * passed in is normalised to digits-only and prefixed with country code 91
 * if it looks like a 10-digit Indian number.
 *
 * Returns `{ ok: false, error: "GallaBox not configured" }` when the env
 * vars aren't set, instead of throwing — callers can decide whether to
 * treat that as a hard failure (production) or a soft one (dev).
 */
export async function sendWhatsAppText(
  rawPhone: string,
  body: string,
  recipientName: string = "Agent"
): Promise<GallaBoxSendResult> {
  const apiKey = process.env.GALLABOX_API_KEY;
  const apiSecret = process.env.GALLABOX_API_SECRET;
  const channelId = process.env.GALLABOX_CHANNEL_ID;

  const cleanPhone = rawPhone.replace(/\D/g, "");
  const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const last10Digits = finalPhone.slice(-10);
  const formattedPhone = `+91 ${last10Digits.slice(0, 5)} ${last10Digits.slice(5)}`;

  // Log to database so the simulator widget can pick it up
  try {
    await supabaseAdmin.from("whatsapp_messages").insert([{
      direction: "outbound",
      phone: formattedPhone,
      message_type: "text",
      content: body,
      source: "gallabox_lib",
      outbound_status: apiKey ? 1 : 0,
      error_message: apiKey ? null : "GallaBox not configured"
    }]);
  } catch (dbErr) {
    console.error("Failed to log outbound whatsapp message:", dbErr);
  }

  if (!apiKey || !apiSecret || !channelId) {
    return {
      ok: false,
      status: null,
      responseBody: null,
      error: "GallaBox not configured (GALLABOX_API_KEY/SECRET/CHANNEL_ID missing)",
    };
  }



  try {
    const res = await fetch("https://server.gallabox.com/devapi/messages/whatsapp", {
      method: "POST",
      headers: {
        apiKey: apiKey,
        apiSecret: apiSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channelId,
        channelType: "whatsapp",
        recipient: { name: recipientName, phone: finalPhone },
        whatsapp: { type: "text", text: { body } },
      }),
    });

    let responseBody: unknown = null;
    try {
      responseBody = await res.json();
    } catch {
      // GallaBox occasionally returns empty bodies on 4xx — that's fine.
    }

    return {
      ok: res.ok,
      status: res.status,
      responseBody,
      error: res.ok ? undefined : `GallaBox HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      responseBody: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}



// -----------------------------------------------------------------------------
// Template-based message for OTP delivery.
//
// WhatsApp Business API requires approved templates to initiate conversations
// with users who haven't previously messaged your number. This function sends
// the OTP via a pre-approved template so ALL users (not just existing contacts)
// receive it.
//
// Template setup in GallaBox:
//   - Go to GallaBox → Templates → Create
//   - Category: Authentication (or Utility)
//   - Name: set via GALLABOX_OTP_TEMPLATE env var (default: "otp_login")
//   - Body: "Your AgentsApp login code is {{1}}. Valid for 10 minutes."
//   - Submit for approval
//
// If the template isn't set up, this falls back to sendWhatsAppText.
// -----------------------------------------------------------------------------

export async function sendWhatsAppOTP(
  rawPhone: string,
  otp: string,
  recipientName: string = "User"
): Promise<GallaBoxSendResult> {
  const apiKey = process.env.GALLABOX_API_KEY;
  const apiSecret = process.env.GALLABOX_API_SECRET;
  const channelId = process.env.GALLABOX_CHANNEL_ID;
  const templateName = process.env.GALLABOX_OTP_TEMPLATE;

  if (!apiKey || !apiSecret || !channelId) {
    return {
      ok: false,
      status: null,
      responseBody: null,
      error: "GallaBox not configured (GALLABOX_API_KEY/SECRET/CHANNEL_ID missing)",
    };
  }

  const cleanPhone = rawPhone.replace(/\D/g, "");
  const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  // If no template configured, fall back to plain text
  // (this will only work for users who already have a conversation)
  if (!templateName) {
    const fallbackBody = `*AgentsApp* login code: *${otp}*\n\nValid for 10 minutes. Do not share this code with anyone.`;
    return sendWhatsAppText(rawPhone, fallbackBody, recipientName);
  }

  // ---------------------------------------------------------------------------
  // GallaBox's devapi does NOT correctly forward parameters for Authentication
  // category templates (error 132000: localizable_params 0). Their API accepts
  // the call (HTTP 202) but silently drops the {{1}} parameter when forwarding
  // to Meta's Cloud API.
  //
  // WORKAROUND: Skip the broken auth template and send OTP as plain text.
  // Plain text works for numbers that have messaged the business number within
  // the last 24 hours.
  //
  // LONG-TERM FIX: Create a UTILITY category template (not Authentication)
  // in GallaBox. Utility templates correctly pass bodyValues. Name it
  // something like "otp_utility" and set GALLABOX_OTP_TEMPLATE to that name.
  // ---------------------------------------------------------------------------

  const plainBody = `Your AgentsApp verification code is *${otp}*\n\nValid for 10 minutes. Do not share this code with anyone.`;
  
  console.log(`[gallabox] Sending OTP as plain text to ${finalPhone} (auth template "${templateName}" has param bug in GallaBox API)`);
  
  const plainResult = await sendWhatsAppText(rawPhone, plainBody, recipientName);
  
  console.log(`[gallabox] Plain text OTP result: status=${plainResult.status}, ok=${plainResult.ok}`, JSON.stringify(plainResult.responseBody));
  
  return plainResult;
}
