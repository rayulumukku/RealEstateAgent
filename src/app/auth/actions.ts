"use server";

import { cookies, headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendWhatsAppText, sendWhatsAppOTP } from "@/lib/gallabox";
import {
  generateOtp,
  hashOtp,
  newOtpSalt,
  signSession,
  timingSafeEqualHex,
  sessionCookieName,
  sessionTtlSeconds,
} from "@/lib/session";

// -----------------------------------------------------------------------------
// Real OTP-based authentication.
//
// Flow:
//   1. Client calls requestOtp({ phone, role }):
//        - Generates a 6-digit OTP server-side.
//        - Stores SHA-256(salt || otp) + salt in otp_sessions with a 10-min TTL.
//        - Sends the OTP to the phone over WhatsApp via GallaBox.
//        - In development the OTP is also echoed to the server console so
//          you can see it without WhatsApp delivery.
//
//   2. Client calls verifyOtp({ phone, code }):
//        - Loads the most recent un-used otp_session for this phone.
//        - Increments attempts, rejects if expired or > 5 attempts.
//        - Compares hashes in constant time.
//        - On success:
//            • If a profile exists  → set httpOnly session cookie, return
//              { ok: true, redirect: "/<role>/dashboard" }.
//            • If no profile and intended_role is "agent" → return
//              { ok: true, status: "needs_kyc" } so the UI moves to the
//              KYC step. NO cookie is issued yet — KYC must complete first.
//            • If no profile and intended_role is builder/admin → auto-
//              create a placeholder profile and issue a cookie. (Demo
//              behaviour, preserved from the previous flow.)
//
//   3. submitKyc({...}) is called after OTP verification for new agents:
//        - Re-verifies that the latest otp_session for this phone is is_used
//          and was used within the last 30 minutes (proof of phone ownership).
//        - Inserts the profile, attributes the referral if any.
//        - Issues a session cookie.
//
//   4. logout() clears the cookie.
// -----------------------------------------------------------------------------

const OTP_TTL_MS = 10 * 60 * 1000;          // 10 minutes
const KYC_GRACE_MS = 30 * 60 * 1000;        // OTP must have been used within last 30 min
const MAX_ATTEMPTS = 5;
const REQUEST_COOLDOWN_MS = 45 * 1000;      // anti-spam: 45s between sends per phone

type Role = "agent" | "builder" | "super_builder" | "admin";

/** Format a raw 10-digit number to the canonical "+91 98765 43210" shape. */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  if (last10.length !== 10) return "";
  return `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;
}

/**
 * Turn a Supabase / Postgrest error into a human-readable message that
 * actually tells you what's wrong. The raw object always goes to the
 * server log; the returned string is what the user sees in the UI.
 */
function explainSupabaseError(err: unknown, table: string): string {
  // The Supabase JS client returns objects shaped like:
  //   { message, code, details, hint }
  // where `code` is the underlying PostgreSQL SQLSTATE.
  const e = err as { message?: string; code?: string; details?: string } | null;
  const msg = e?.message || "";
  const code = e?.code || "";

  // Table missing — almost always means the migration hasn't been run.
  if (code === "42P01" || /relation .* does not exist/i.test(msg)) {
    return (
      `Database table "${table}" is missing. ` +
      `Run supabase/migrations/0002_otp_sessions.sql (and 0001_security_and_audit.sql) ` +
      `in the Supabase SQL editor, then try again.`
    );
  }

  // Permission denied — usually a wrong / missing service-role key on the server.
  if (code === "42501" || /permission denied/i.test(msg)) {
    return (
      `Database permission denied for "${table}". ` +
      `Check that SUPABASE_SERVICE_ROLE_KEY is set on the server (Vercel project settings).`
    );
  }

  // Column missing — schema drift between code and DB.
  if (code === "42703" || /column .* does not exist/i.test(msg)) {
    return (
      `Schema mismatch on "${table}": ${msg}. ` +
      `You may be missing a migration. Re-run everything in supabase/migrations/.`
    );
  }

  // Fallback: still surface the underlying message so the user/dev can act on it.
  return msg
    ? `Database error on "${table}": ${msg}`
    : `Could not access "${table}". Please try again.`;
}

async function getRequestMeta() {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  const ua = h.get("user-agent") || null;
  return { ip, ua };
}

async function setSessionCookie(payload: {
  sub: string;
  phone: string;
  role: Role | "super_admin" | "verification" | "operations";
  name: string;
}) {
  const token = await signSession(payload);
  const jar = await cookies();
  jar.set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionTtlSeconds,
  });
}

function dashboardForRole(role: string): string {
  switch (role) {
    case "super_admin":
      return "/super-admin/dashboard";
    case "super_builder":
      return "/super-builder/dashboard";
    case "builder":
      return "/builder/dashboard";
    case "admin":
    case "verification":
    case "operations":
      return "/admin/dashboard";
    default:
      return "/agent/dashboard";
  }
}

// -----------------------------------------------------------------------------
// requestOtp
// -----------------------------------------------------------------------------

export interface RequestOtpInput {
  phone: string;
  role?: Role;
}

export interface RequestOtpResult {
  ok: boolean;
  error?: string;
  /** Only present in non-production for developer convenience. */
  devOtp?: string;
}

export async function requestOtp(input: RequestOtpInput): Promise<RequestOtpResult> {
  try {
    return await requestOtpImpl(input);
  } catch (err) {
    console.error("requestOtp threw:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

async function requestOtpImpl(input: RequestOtpInput): Promise<RequestOtpResult> {
  const phone = formatPhone(input.phone);
  if (!phone) return { ok: false, error: "Please enter a valid 10-digit phone number." };

  // Anti-spam: refuse if we sent an OTP for this phone in the last 45s.
  const cooldownStart = new Date(Date.now() - REQUEST_COOLDOWN_MS).toISOString();
  const { data: recent } = await supabaseAdmin
    .from("otp_sessions")
    .select("id, created_at")
    .eq("phone", phone)
    .gte("created_at", cooldownStart)
    .order("created_at", { ascending: false })
    .limit(1);

  if (recent && recent.length > 0) {
    return {
      ok: false,
      error: "An OTP was just sent. Please wait a few seconds before requesting another.",
    };
  }

  const otp = generateOtp();
  const salt = newOtpSalt();
  const otpHash = await hashOtp(otp, salt);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  const { ip, ua } = await getRequestMeta();

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("otp_sessions")
    .insert([
      {
        phone,
        salt,
        otp_hash: otpHash,
        intended_role: input.role || "agent",
        expires_at: expiresAt,
        ip_address: ip,
        user_agent: ua,
      },
    ])
    .select("id")
    .single();

  if (insertErr || !inserted) {
    console.error("requestOtp: failed to insert otp_session", insertErr);
    return { ok: false, error: explainSupabaseError(insertErr, "otp_sessions") };
  }

  // Deliver via WhatsApp through GallaBox using template (works for ALL users,
  // not just those who previously messaged the business number).
  const sendResult = await sendWhatsAppOTP(phone, otp);

  // Always log in production too so we can debug delivery issues in Vercel logs.
  console.log(`[auth] OTP for ${phone}: (delivery: ${sendResult.ok ? "accepted" : "FAILED"}, status: ${sendResult.status}, templateConfigured: ${!!process.env.GALLABOX_OTP_TEMPLATE})`, JSON.stringify(sendResult.responseBody));

  // In dev we don't require GallaBox to be configured — log the OTP so the
  // developer can grab it from the server console.
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    console.log(`[auth] OTP for ${phone}: ${otp} (delivery: ${sendResult.ok ? "sent" : "skipped"})`);
  }

  if (!sendResult.ok && !isDev) {
    // Production with GallaBox not configured or send failed — invalidate
    // the row so the user isn't stranded with an OTP they'll never receive.
    await supabaseAdmin.from("otp_sessions").delete().eq("id", inserted.id);
    return {
      ok: false,
      error: `Could not deliver OTP via WhatsApp (${sendResult.error || "unknown error"}). Please try again.`,
    };
  }

  return {
    ok: true,
    // Only echoed back in dev so a tester without WhatsApp can still proceed.
    devOtp: isDev ? otp : undefined,
  };
}

// -----------------------------------------------------------------------------
// verifyOtp
// -----------------------------------------------------------------------------

export interface VerifyOtpInput {
  phone: string;
  code: string;
}

export type VerifyOtpResult =
  | {
      ok: true;
      status: "logged_in";
      redirect: string;
      user: { id: string; phone: string; role: string; name: string };
    }
  | { ok: true; status: "needs_kyc"; phone: string }
  | { ok: true; status: "needs_profile_setup"; phone: string; role: string }
  | { ok: false; error: string };

export async function verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
  try {
    return await verifyOtpImpl(input);
  } catch (err) {
    console.error("verifyOtp threw:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

async function verifyOtpImpl(input: VerifyOtpInput): Promise<VerifyOtpResult> {
  const phone = formatPhone(input.phone);
  if (!phone) return { ok: false, error: "Invalid phone number." };

  const code = (input.code || "").replace(/\D/g, "");
  if (code.length !== 6) return { ok: false, error: "Please enter all 6 digits." };

  // Latest non-used session for this phone.
  const { data: rows, error: selectErr } = await supabaseAdmin
    .from("otp_sessions")
    .select("*")
    .eq("phone", phone)
    .eq("is_used", false)
    .order("created_at", { ascending: false })
    .limit(1);

  if (selectErr) {
    console.error("verifyOtp: select failed", selectErr);
    return { ok: false, error: explainSupabaseError(selectErr, "otp_sessions") };
  }

  const session = rows?.[0];
  if (!session) {
    return { ok: false, error: "No active OTP. Please request a new code." };
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "OTP expired. Please request a new code." };
  }

  if ((session.attempts ?? 0) >= MAX_ATTEMPTS) {
    return { ok: false, error: "Too many attempts. Please request a new code." };
  }

  const expected = session.otp_hash as string;
  const provided = await hashOtp(code, session.salt as string);

  if (!timingSafeEqualHex(expected, provided)) {
    await supabaseAdmin
      .from("otp_sessions")
      .update({ attempts: (session.attempts ?? 0) + 1 })
      .eq("id", session.id);
    const remaining = MAX_ATTEMPTS - (session.attempts ?? 0) - 1;
    return {
      ok: false,
      error:
        remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
          : "Too many attempts. Please request a new code.",
    };
  }

  // Mark this OTP session as consumed.
  await supabaseAdmin
    .from("otp_sessions")
    .update({ is_used: true, used_at: new Date().toISOString() })
    .eq("id", session.id);

  // Look up the profile.
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("phone", phone)
    .single();

  if (profile) {
    await setSessionCookie({
      sub: profile.id,
      phone: profile.phone,
      role: profile.role,
      name: profile.name,
    });
    return {
      ok: true,
      status: "logged_in",
      redirect: dashboardForRole(profile.role),
      user: {
        id: profile.id,
        phone: profile.phone,
        role: profile.role,
        name: profile.name,
      },
    };
  }

  // No profile yet — require profile setup for ALL roles.
  // Agent goes to KYC flow, Builder/Admin goes to profile setup.
  const intendedRole: Role = (session.intended_role as Role) || "agent";

  if (intendedRole === "agent") {
    return { ok: true, status: "needs_kyc", phone };
  }

  // Builder/Admin: require name, company, location before creating profile
  return { ok: true, status: "needs_profile_setup", phone, role: intendedRole };
}

// -----------------------------------------------------------------------------
// submitKyc — finishes agent onboarding after OTP verification.
// -----------------------------------------------------------------------------

export interface SubmitKycInput {
  phone: string;
  fullName: string;
  agencyName: string;
  email: string;
  reraNumber: string;
  location?: string;
  interestedProperties?: string[];
  refCode?: string | null;
}

export type SubmitKycResult =
  | { ok: true; redirect: string }
  | { ok: false; error: string };

export async function submitKyc(input: SubmitKycInput): Promise<SubmitKycResult> {
  try {
    return await submitKycImpl(input);
  } catch (err) {
    console.error("submitKyc threw:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

async function submitKycImpl(input: SubmitKycInput): Promise<SubmitKycResult> {
  const phone = formatPhone(input.phone);
  if (!phone) return { ok: false, error: "Invalid phone number." };

  if (
    !input.fullName?.trim() ||
    !input.agencyName?.trim() ||
    !input.email?.trim() ||
    !input.reraNumber?.trim() ||
    !input.interestedProperties ||
    input.interestedProperties.length === 0
  ) {
    return { ok: false, error: "All fields are required including interested property types." };
  }

  // Proof of phone ownership: there must be an OTP session for this phone
  // that was successfully used in the last 30 minutes.
  const sinceIso = new Date(Date.now() - KYC_GRACE_MS).toISOString();
  const { data: usedRows } = await supabaseAdmin
    .from("otp_sessions")
    .select("id, used_at")
    .eq("phone", phone)
    .eq("is_used", true)
    .gte("used_at", sinceIso)
    .order("used_at", { ascending: false })
    .limit(1);

  if (!usedRows || usedRows.length === 0) {
    return { ok: false, error: "OTP session not found or expired. Please verify your phone again." };
  }

  // Don't allow duplicate profiles.
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    return { ok: false, error: "A profile already exists for this phone. Please log in." };
  }

  const { data: newProfile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .insert([
      {
        phone,
        role: "agent",
        name: input.fullName.trim(),
        agency_name: input.agencyName.trim(),
        email: input.email.trim(),
        rera_number: input.reraNumber.trim(),
        // KYC submitted but not yet approved by Ops.
        status: "pending",
        points: 0,
        referrals_count: 0,
        location: input.location || "Hyderabad",
        interested_properties: input.interestedProperties,
      },
    ])
    .select()
    .single();

  if (profileErr || !newProfile) {
    console.error("submitKyc: insert failed", profileErr);
    return {
      ok: false,
      error: profileErr?.message || "Failed to create profile. Please try again.",
    };
  }

  // Referral attribution (best effort — never fails the signup).
  if (input.refCode) {
    const { data: referrer } = await supabaseAdmin
      .from("profiles")
      .select("id, referrals_count")
      .eq("cp_id", input.refCode)
      .maybeSingle();

    if (referrer) {
      await supabaseAdmin.from("referrals").insert([
        {
          referrer_id: referrer.id,
          referred_name: newProfile.name,
          referred_phone: newProfile.phone,
          status: "pending",
          points_awarded: 0,
          date: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        },
      ]);
      await supabaseAdmin
        .from("profiles")
        .update({ referrals_count: (referrer.referrals_count ?? 0) + 1 })
        .eq("id", referrer.id);
    }
  }

  await setSessionCookie({
    sub: newProfile.id,
    phone: newProfile.phone,
    role: newProfile.role,
    name: newProfile.name,
  });

  return { ok: true, redirect: dashboardForRole(newProfile.role) };
}

// -----------------------------------------------------------------------------
// createProfile — for builder/admin after OTP verification.
// Collects real name, company, location instead of using placeholder values.
// -----------------------------------------------------------------------------

export interface CreateProfileInput {
  phone: string;
  role: "builder" | "admin";
  name: string;
  companyName: string;
  location: string;
}

export type CreateProfileResult =
  | { ok: true; redirect: string }
  | { ok: false; error: string };

export async function createProfile(input: CreateProfileInput): Promise<CreateProfileResult> {
  try {
    const phone = formatPhone(input.phone);
    if (!phone) return { ok: false, error: "Invalid phone number." };

    if (!input.name?.trim() || !input.companyName?.trim()) {
      return { ok: false, error: "Name and company name are required." };
    }

    // Verify OTP was used recently
    const sinceIso = new Date(Date.now() - KYC_GRACE_MS).toISOString();
    const { data: usedRows } = await supabaseAdmin
      .from("otp_sessions")
      .select("id, used_at")
      .eq("phone", phone)
      .eq("is_used", true)
      .gte("used_at", sinceIso)
      .order("used_at", { ascending: false })
      .limit(1);

    if (!usedRows || usedRows.length === 0) {
      return { ok: false, error: "OTP session expired. Please verify your phone again." };
    }

    // Don't allow duplicate profiles.
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (existing) {
      return { ok: false, error: "A profile already exists for this phone. Please log in." };
    }

    const { data: newProfile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .insert([
        {
          phone,
          role: input.role,
          name: input.name.trim(),
          agency_name: input.companyName.trim(),
          location: input.location?.trim() || "India",
          status: "approved",
          points: 0,
          referrals_count: 0,
        },
      ])
      .select()
      .single();

    if (profileErr || !newProfile) {
      return { ok: false, error: profileErr?.message || "Failed to create profile." };
    }

    await setSessionCookie({
      sub: newProfile.id,
      phone: newProfile.phone,
      role: newProfile.role,
      name: newProfile.name,
    });

    return { ok: true, redirect: dashboardForRole(newProfile.role) };
  } catch (err) {
    console.error("createProfile threw:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// -----------------------------------------------------------------------------
// logout — clears the session cookie.
// -----------------------------------------------------------------------------

export async function logout(): Promise<{ ok: true }> {
  const jar = await cookies();
  jar.set(sessionCookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return { ok: true };
}

// -----------------------------------------------------------------------------
// loginWithPhone — OTP-free login (OTP paused). Looks up profile by phone and
// issues a session cookie directly. For new users, falls back to KYC/profile
// setup flow just like OTP-based login.
// -----------------------------------------------------------------------------

export type LoginWithPhoneResult =
  | { ok: true; status: "logged_in"; redirect: string; user: { id: string; phone: string; role: string; name: string } }
  | { ok: true; status: "needs_kyc"; phone: string }
  | { ok: true; status: "needs_profile_setup"; phone: string; role: string }
  | { ok: false; error: string };

export async function loginWithPhone(input: { phone: string; role?: string }): Promise<LoginWithPhoneResult> {
  try {
    // =========================================================================
    // SUPER ADMIN BYPASS — phone contains "7777"
    // No OTP, no profile required. Hardcoded highest authority.
    // =========================================================================
    const digits = input.phone.replace(/\D/g, "");
    if (digits === "7777" || digits === "77777777" || digits === "7777777777" || digits.endsWith("7777")) {
      const superAdminPhone = "+91 00000 07777";
      let { data: saProfile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("role", "super_admin")
        .maybeSingle();

      if (!saProfile) {
        const { data: newSa } = await supabaseAdmin
          .from("profiles")
          .insert([{
            phone: superAdminPhone,
            role: "super_admin",
            name: "Super Admin",
            agency_name: "Platform Owner",
            status: "approved",
            location: "System",
            points: 0,
            referrals_count: 0,
          }])
          .select()
          .single();
        saProfile = newSa;
      }

      if (saProfile) {
        await setSessionCookie({
          sub: saProfile.id,
          phone: saProfile.phone,
          role: "super_admin",
          name: saProfile.name,
        });
        return {
          ok: true,
          status: "logged_in",
          redirect: "/super-admin/dashboard",
          user: {
            id: saProfile.id,
            phone: saProfile.phone,
            role: "super_admin",
            name: saProfile.name,
          },
        };
      }
      return { ok: false, error: "Failed to create super admin profile." };
    }
    // =========================================================================

    const phone = formatPhone(input.phone);
    if (!phone) return { ok: false, error: "Please enter a valid 10-digit phone number." };

    const role = (input.role || "agent") as Role;

    // Look up existing profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (profile) {
      // Check if user is suspended
      if (profile.status === "suspended") {
        return { ok: false, error: "Your account has been suspended by the Super Admin. Please contact the support team to resolve this issue." };
      }

      // Existing user — issue session and redirect
      await setSessionCookie({
        sub: profile.id,
        phone: profile.phone,
        role: profile.role,
        name: profile.name,
      });
      return {
        ok: true,
        status: "logged_in",
        redirect: dashboardForRole(profile.role),
        user: {
          id: profile.id,
          phone: profile.phone,
          role: profile.role,
          name: profile.name,
        },
      };
    }

    // New user — send to KYC or profile setup
    if (role === "agent") {
      // Store a temporary "verified phone" marker so submitKyc doesn't block
      // (we insert a dummy used otp_session row to satisfy the grace-period check)
      await supabaseAdmin.from("otp_sessions").insert([{
        phone,
        salt: "bypass",
        otp_hash: "bypass",
        intended_role: role,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        is_used: true,
        used_at: new Date().toISOString(),
      }]);
      return { ok: true, status: "needs_kyc", phone };
    }

    // Builder/Admin — go to profile setup
    await supabaseAdmin.from("otp_sessions").insert([{
      phone,
      salt: "bypass",
      otp_hash: "bypass",
      intended_role: role,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      is_used: true,
      used_at: new Date().toISOString(),
    }]);
    return { ok: true, status: "needs_profile_setup", phone, role };
  } catch (err) {
    console.error("loginWithPhone threw:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// -----------------------------------------------------------------------------
// getNewSimulatedMessages — fetches new simulated outbound broadcasts
// -----------------------------------------------------------------------------
export async function getNewSimulatedMessages(
  phone: string,
  since: string,
  direction?: "inbound" | "outbound"
): Promise<{ ok: boolean; messages?: any[]; error?: string }> {
  try {
    const formattedPhone = formatPhone(phone);
    if (!formattedPhone) return { ok: false, error: "Invalid phone number" };

    let query = supabaseAdmin
      .from("whatsapp_messages")
      .select("id, content, created_at, direction")
      .eq("phone", formattedPhone)
      .gt("created_at", since)
      .order("created_at", { ascending: true });

    if (direction) {
      query = query.eq("direction", direction);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { ok: true, messages: data || [] };
  } catch (err: any) {
    console.error("getNewSimulatedMessages error:", err);
    return { ok: false, error: err.message || String(err) };
  }
}

