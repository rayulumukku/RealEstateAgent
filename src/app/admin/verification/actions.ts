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

import { sendWhatsAppText } from "@/lib/gallabox";

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

    // 3. Send WhatsApp confirmation message
    const msg = `🎉 Congratulations ${name}!\n\nYour profile has been verified by the admin.\nYour Partner ID is: *${generatedId}*\n\nYou can now log in to the portal and start using AgentsApp!`;
    await sendWhatsAppText(phone, msg);

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

export async function toggleReraApprovalAction(profileId: string, isApproved: boolean) {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ is_rera_approved: isApproved })
      .eq("id", profileId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error("Error in toggleReraApprovalAction:", err);
    return { success: false, error: err.message };
  }
}

export async function updateBuilderCreditsAction(builderId: string, credits: number) {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ credits: credits })
      .eq("id", builderId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error("Error in updateBuilderCreditsAction server action:", err);
    return { success: false, error: err.message };
  }
}

export async function getPendingLinkRequests() {
  try {
    const { data, error } = await supabase
      .from("sub_builder_requests")
      .select("*, super_builder:profiles!super_builder_id(name, agency_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { success: true, requests: data || [] };
  } catch (err: any) {
    console.error("Error in getPendingLinkRequests:", err);
    return { success: false, error: err.message || "Failed to load link requests", requests: [] };
  }
}

export async function handleLinkRequestAction(requestId: string, approve: boolean) {
  try {
    if (approve) {
      // Fetch request details
      const { data: req, error: fetchErr } = await supabase
        .from("sub_builder_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (fetchErr || !req) throw new Error("Link request not found");

      // Find target builder profile by phone
      const { data: builder, error: builderErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", req.builder_phone)
        .single();

      if (builderErr || !builder) throw new Error("Target builder account not found by phone number.");

      // Link builder to the parent Super Builder
      const { error: updateProfileErr } = await supabase
        .from("profiles")
        .update({ parent_id: req.super_builder_id })
        .eq("id", builder.id);

      if (updateProfileErr) throw updateProfileErr;

      // Update request status to approved
      const { error: updateReqErr } = await supabase
        .from("sub_builder_requests")
        .update({ status: "approved" })
        .eq("id", requestId);

      if (updateReqErr) throw updateReqErr;
    } else {
      // Update request status to rejected
      const { error: updateReqErr } = await supabase
        .from("sub_builder_requests")
        .update({ status: "rejected" })
        .eq("id", requestId);

      if (updateReqErr) throw updateReqErr;
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error in handleLinkRequestAction server action:", err);
    return { success: false, error: err.message || "Action failed" };
  }
}

