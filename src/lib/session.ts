// -----------------------------------------------------------------------------
// Session JWTs and OTP hashing — implemented with the Web Crypto API.
//
// Why Web Crypto instead of node:crypto:
//   This module is imported by both server actions / route handlers (Node
//   runtime) AND by middleware (Edge runtime). The Edge runtime does NOT
//   provide Node's `crypto` module, so `import crypto from "crypto"` made
//   middleware silently treat every request as unauthenticated, redirecting
//   logged-in users back to /auth/login. Web Crypto's `globalThis.crypto`
//   is available in both runtimes (Node 20+ and Edge), keeping a single
//   portable implementation.
//
// Format: base64url(headerJSON).base64url(payloadJSON).base64url(hmacSig)
// Algorithm: HS256 (HMAC-SHA256) keyed by AUTH_SECRET.
// -----------------------------------------------------------------------------

export interface SessionPayload {
  sub: string;        // profile.id
  phone: string;      // profile.phone, e.g. "+91 98765 43210"
  role: "agent" | "builder" | "admin" | "verification" | "operations";
  name: string;
  iat: number;        // issued-at, seconds since epoch
  exp: number;        // expiry, seconds since epoch
}

const SESSION_COOKIE_NAME = "agentsapp_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const sessionCookieName = SESSION_COOKIE_NAME;
export const sessionTtlSeconds = SESSION_TTL_SECONDS;

function getSecretBytes(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Generate one with " +
        '`node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"` ' +
        "and set it in your environment."
    );
  }
  return new TextEncoder().encode(secret);
}

// -----------------------------------------------------------------------------
// base64url helpers — atob/btoa are global in both Node 18+ and Edge.
// -----------------------------------------------------------------------------

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  const normalised = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised + "===".slice((normalised.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

async function getHmacKey(): Promise<CryptoKey> {
  const keyData = getSecretBytes();
  return crypto.subtle.importKey(
    "raw",
    keyData.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// -----------------------------------------------------------------------------
// signSession / verifySession
// -----------------------------------------------------------------------------

export async function signSession(
  payload: Omit<SessionPayload, "iat" | "exp">,
  ttlSeconds: number = SESSION_TTL_SECONDS
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SessionPayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };

  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = bytesToBase64Url(utf8(JSON.stringify(header)));
  const payloadB64 = bytesToBase64Url(utf8(JSON.stringify(fullPayload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await getHmacKey();
  const sigInput = utf8(signingInput);
  const sig = await crypto.subtle.sign("HMAC", key, sigInput.buffer as ArrayBuffer);
  return `${signingInput}.${bytesToBase64Url(new Uint8Array(sig))}`;
}

/**
 * Verify and parse an HS256 JWT. Returns null on any failure
 * (bad signature, expired, malformed). Never throws.
 */
export async function verifySession(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;

  let key: CryptoKey;
  try {
    key = await getHmacKey();
  } catch {
    // AUTH_SECRET missing — fail closed (no session) rather than crashing
    // middleware. The user gets cleanly redirected to /auth/login.
    return null;
  }

  let providedSig: Uint8Array;
  try {
    providedSig = base64UrlToBytes(sigB64);
  } catch {
    return null;
  }

  let valid: boolean;
  try {
    const sigInputBytes = utf8(signingInput);
    valid = await crypto.subtle.verify("HMAC", key, providedSig.buffer as ArrayBuffer, sigInputBytes.buffer as ArrayBuffer);
  } catch {
    return null;
  }
  if (!valid) return null;

  let payload: SessionPayload;
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(payloadB64));
    payload = JSON.parse(json) as SessionPayload;
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) return null;

  return payload;
}

// -----------------------------------------------------------------------------
// OTP hashing — SHA-256(salt || otp). 6-digit OTPs over a 10-minute TTL with
// max 5 attempts don't need bcrypt's work factor; salted SHA-256 is fine.
// -----------------------------------------------------------------------------

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

export function generateOtp(): string {
  // Crypto-safe 6-digit code: 4 random bytes -> 32-bit unsigned -> mod 1e6.
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const num = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return (num % 1_000_000).toString().padStart(6, "0");
}

export async function hashOtp(otp: string, salt: string): Promise<string> {
  const data = utf8(`${salt}${otp}`);
  const hash = await crypto.subtle.digest("SHA-256", data.buffer as ArrayBuffer);
  return bytesToHex(new Uint8Array(hash));
}

export function newOtpSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/**
 * Constant-time hex string comparison. Web Crypto doesn't expose a
 * timing-safe equal helper directly, so this is implemented manually.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
