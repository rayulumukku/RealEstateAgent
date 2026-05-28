import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// POST /api/followers — collect name + email for app updates
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone } = body;

    if (!name || !email) {
      return NextResponse.json(
        { ok: false, error: "Name and email are required." },
        { status: 400 }
      );
    }

    // Check if already subscribed
    const { data: existing } = await supabaseAdmin
      .from("app_followers")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        ok: true,
        message: "You're already subscribed for updates!",
      });
    }

    const { error } = await supabaseAdmin.from("app_followers").insert([{
      name,
      email,
      phone: phone || null,
      source: "landing_page",
    }]);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "Successfully subscribed! You'll receive app updates at " + email,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
