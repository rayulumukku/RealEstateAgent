import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import * as chrono from "chrono-node";

// -----------------------------------------------------------------------------
// Cron Job: Process Reminders
// -----------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  // 1. Fetch pending reminders
  const { data: reminders, error } = await supabaseAdmin
    .from("reminders")
    .select("*, profiles!inner(phone)")
    .eq("is_completed", false);

  if (error) {
    console.error("Cron Reminders: Error fetching reminders", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!reminders || reminders.length === 0) {
    return NextResponse.json({ status: "success", processed: 0, message: "No pending reminders." });
  }

  const now = new Date();
  let processedCount = 0;

  for (const reminder of reminders) {
    const timeStr = reminder.scheduled_time;
    let parsedDate: Date | null = null;
    
    // First try standard ISO string parsing in case it's saved nicely
    const isoDate = new Date(timeStr);
    if (!isNaN(isoDate.getTime()) && timeStr.includes("T")) {
       parsedDate = isoDate;
    } else {
       // Fallback to NLP parsing, forcing IST timezone (+330 mins)
       parsedDate = chrono.parseDate(timeStr, new Date(), { timezone: 330 } as any);
    }

    if (parsedDate && parsedDate <= now) {
      console.log(`Cron Reminders: Sending reminder ${reminder.id} to ${reminder.profiles.phone}`);
      
      const phone = reminder.profiles.phone;
      const text = `🤖 *Reminder!*\n\n⏰ Task: *${reminder.title}*`;

      await supabaseAdmin.from("reminders").update({ is_completed: true }).eq("id", reminder.id);
      
      const apiKey = process.env.GALLABOX_API_KEY;
      const apiSecret = process.env.GALLABOX_API_SECRET;
      const channelId = process.env.GALLABOX_CHANNEL_ID;
      
      if (apiKey && apiSecret && channelId) {
        const cleanPhone = phone.replace(/\D/g, "");
        const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        
        try {
          await fetch("https://server.gallabox.com/devapi/messages/whatsapp", {
            method: "POST",
            headers: {
              "apiKey": apiKey,
              "apiSecret": apiSecret,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              channelId: channelId,
              channelType: "whatsapp",
              recipient: {
                name: "Agent",
                phone: finalPhone
              },
              whatsapp: {
                type: "text",
                text: { body: text }
              }
            })
          });
        } catch (e) {
          console.error("GallaBox Cron Send Error:", e);
        }
      }

      await supabaseAdmin.from("whatsapp_messages").insert([{
        direction: "outbound",
        phone: phone,
        message_type: "text",
        content: text,
        source: "cron"
      }]);

      processedCount++;
    }
  }

  return NextResponse.json({ status: "success", processed: processedCount });
}
