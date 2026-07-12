"use server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

export async function dumpDatabase() {
  const { data: channel_partners } = await supabase.from("channel_partners").select("*");
  const { data: profiles } = await supabase.from("profiles").select("id, name, phone, role").in("role", ["agent", "builder"]);
  
  return { channel_partners, profiles };
}
