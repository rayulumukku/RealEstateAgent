import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  try {
    const { data: events } = await supabaseAdmin.from("events").select("*").order("created_at", { ascending: false });
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, name, phone, role, status, rera_number, is_rera_approved");
    const { data: rsvps } = await supabaseAdmin.from("rsvps").select("*");
    return NextResponse.json({ events, profiles, rsvps });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
