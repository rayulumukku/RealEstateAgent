"use server";

import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

export async function getVerificationRequests() {
  try {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .in("role", ["agent", "builder"])
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Fetch referrals to match referredBy
    const { data: referrals, error: refError } = await supabase
      .from("referrals")
      .select("referred_phone, referrer_id, profiles(cp_id)");

    return { success: true, profiles: profiles || [], referrals: referrals || [] };
  } catch (err: any) {
    console.error("Error in getVerificationRequests server action:", err);
    return { success: false, error: err.message, profiles: [], referrals: [] };
  }
}

export async function approveAgentAction(id: string, phone: string, name: string) {
  try {
    const generatedId = `CP-${Math.floor(1000 + Math.random() * 9000)}`;

    // 1. Update Agent status in profiles to approved and assign CP ID
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        status: "approved",
        cp_id: generatedId
      })
      .eq("id", id);

    if (profileError) throw profileError;

    // 2. Query referrals table to find match
    const { data: referral } = await supabase
      .from("referrals")
      .select("*")
      .eq("referred_phone", phone)
      .eq("status", "pending")
      .maybeSingle();

    if (referral) {
      // Update referral record in database
      await supabase
        .from("referrals")
        .update({
          status: "approved",
          points_awarded: 500
        })
        .eq("id", referral.id);

      // Fetch referrer's current points
      const { data: referrer } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", referral.referrer_id)
        .maybeSingle();

      if (referrer) {
        const newPoints = (referrer.points || 0) + 500;
        
        // Add 500 XP to referrer points
        await supabase
          .from("profiles")
          .update({ points: newPoints })
          .eq("id", referrer.id);
      }
    }

    return { success: true, generatedId };
  } catch (err: any) {
    console.error("Error in approveAgentAction server action:", err);
    return { success: false, error: err.message };
  }
}

export async function requestDocsAction(id: string) {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ status: "docs_required" })
      .eq("id", id);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error("Error in requestDocsAction:", err);
    return { success: false, error: err.message };
  }
}

export async function rejectAgentAction(id: string, phone: string, reason: string) {
  try {
    // 1. Update Agent status to rejected in profiles
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        status: "rejected",
        rejection_reason: reason
      })
      .eq("id", id);

    if (profileError) throw profileError;

    // 2. Update referral record if match exists
    await supabase
      .from("referrals")
      .update({ status: "rejected" })
      .eq("referred_phone", phone);

    return { success: true };
  } catch (err: any) {
    console.error("Error in rejectAgentAction server action:", err);
    return { success: false, error: err.message };
  }
}
