-- =============================================================================
-- Migration: 0002_otp_sessions
-- Purpose: real OTP-based authentication. Replaces the hardcoded "123456"
--          dev shortcut with server-generated, hashed, time-limited OTPs
--          delivered via the existing GallaBox WhatsApp pipeline.
--
-- Security:
--   - The OTP itself is NEVER stored in plaintext. We store SHA-256(salt || otp)
--     plus the salt; verification re-hashes the user-supplied code and compares
--     in constant time.
--   - Sessions expire after 10 minutes.
--   - max 5 failed verify attempts per session.
--   - one row per (phone, created_at) — old rows are kept for audit.
-- =============================================================================

CREATE TABLE IF NOT EXISTS otp_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- E.164-ish formatted phone, e.g. "+91 98765 43210" to match profiles.phone.
  phone       VARCHAR(20) NOT NULL,

  -- Random per-row salt (hex) and SHA-256 hash of (salt || otp).
  salt        VARCHAR(64) NOT NULL,
  otp_hash    VARCHAR(64) NOT NULL,

  -- Optional role hint captured at /auth/login (agent/builder/admin).
  -- Used to decide redirect target on successful login.
  intended_role VARCHAR(20),

  expires_at  TIMESTAMPTZ NOT NULL,
  is_used     BOOLEAN     NOT NULL DEFAULT FALSE,
  attempts    INTEGER     NOT NULL DEFAULT 0,

  -- Light-touch audit trail.
  ip_address  INET,
  user_agent  TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at     TIMESTAMPTZ
);

-- Look up the most recent active session for a phone fast.
CREATE INDEX IF NOT EXISTS otp_sessions_phone_created_idx
  ON otp_sessions (phone, created_at DESC);

-- Sweep expired/used rows efficiently if we add a cleanup job.
CREATE INDEX IF NOT EXISTS otp_sessions_expires_at_idx
  ON otp_sessions (expires_at);
