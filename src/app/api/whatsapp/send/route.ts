import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { phone, text } = await req.json();

    if (!phone || !text) {
      return NextResponse.json({ error: "Missing phone or text" }, { status: 400 });
    }

    const apiKey = process.env.GALLABOX_API_KEY;
    const apiSecret = process.env.GALLABOX_API_SECRET;
    const channelId = process.env.GALLABOX_CHANNEL_ID;

    if (!apiKey || !apiSecret || !channelId) {
      console.warn("GallaBox credentials not fully configured in environment.");
      return NextResponse.json({ error: "GallaBox not configured" }, { status: 500 });
    }

    // Clean phone number format: extract digits
    const cleanPhone = phone.replace(/\D/g, "");
    
    // Ensure it starts with country code 91 if it's a 10 digit Indian number
    const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    console.log(`Sending GallaBox message to: ${finalPhone}`);

    const response = await fetch("https://server.gallabox.com/devapi/messages/whatsapp", {
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
          text: {
            body: text
          }
        }
      })
    });

    const data = await response.json();
    console.log("GallaBox Outbound API Response:", JSON.stringify(data));

    if (response.ok) {
      return NextResponse.json({ success: true, data });
    } else {
      return NextResponse.json({ error: data.message || "Failed to send message via GallaBox" }, { status: response.status });
    }
  } catch (err: any) {
    console.error("Error in GallaBox send route:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
