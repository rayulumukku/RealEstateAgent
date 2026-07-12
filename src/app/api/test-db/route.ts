import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { data, error } = await supabase.from("documents").select("*").limit(1);
    return NextResponse.json({ data, error });
  } catch (err: any) {
    return NextResponse.json({ exception: err.message });
  }
}
