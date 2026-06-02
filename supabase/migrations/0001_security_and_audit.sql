-- =============================================================================
-- Migration: 0001_security_and_audit
-- Purpose:
--   1. Extend enums to cover values already used by the UI/spec but missing
--      from the base schema (BLOCKED/HOLD units, FOLLOW_UP_LATER lead status,
--      verification + operations user roles).
--   2. Add reminders.remind_at TIMESTAMPTZ alongside the legacy
--      scheduled_time string so the reminder scheduler (PR #5) can query and
--      schedule by real timestamps without breaking the existing UI.
--   3. Introduce two audit tables required by the project document:
--        - whatsapp_messages: replaces the temporary "Webhook Debug Log"
--          row hack inside the profiles table.
--        - lead_activities: per-lead audit trail of status changes,
--          notes, and reminders. Required by the engagement-score logic.
--
-- Idempotency: every statement is guarded so this file can be re-run
-- safely against a partially-migrated database.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enum extensions
-- -----------------------------------------------------------------------------
-- ALTER TYPE ... ADD VALUE IF NOT EXISTS is non-transactional and is the
-- recommended way to extend an enum without taking an exclusive lock.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'verification';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'operations';

ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'follow_up_later';

ALTER TYPE unit_status ADD VALUE IF NOT EXISTS 'blocked';
ALTER TYPE unit_status ADD VALUE IF NOT EXISTS 'hold';

-- -----------------------------------------------------------------------------
-- 2. reminders.remind_at — proper timestamp column
-- -----------------------------------------------------------------------------
-- We keep the legacy `scheduled_time` VARCHAR for backward compatibility
-- with rows seeded by schema.sql; the UI continues to render it. New code
-- should write `remind_at` and read `COALESCE(remind_at, ...)`.
ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS remind_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS reminders_remind_at_idx
  ON reminders (remind_at)
  WHERE is_completed = FALSE;

CREATE INDEX IF NOT EXISTS reminders_agent_id_idx
  ON reminders (agent_id);

-- -----------------------------------------------------------------------------
-- 3. whatsapp_messages — full inbound/outbound bot message log
-- -----------------------------------------------------------------------------
-- Replaces the previous diagnostics hack (which kept overwriting a single
-- row inside the profiles table). One row per inbound or outbound message.

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Direction of the message from the platform's perspective.
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),

  -- Phone in E.164-ish form, e.g. "+919999999999". May be NULL for
  -- malformed inbound payloads we still want to record.
  phone VARCHAR(20),

  -- The broker profile we matched this phone to, if any.
  agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Original WhatsApp message id ("wamid") when known; useful for de-dup.
  wamid VARCHAR(100),

  -- "text", "image", "audio", "document", "interactive", "system", ...
  message_type VARCHAR(20) NOT NULL DEFAULT 'text',

  -- The message text (inbound: what the broker typed; outbound: what we
  -- sent back).
  content TEXT,

  -- Parsed bot intent (e.g. "add_lead", "set_reminder", "search_inventory")
  -- and extracted entities. Populated by the bot engine; null for raw logs.
  parsed_intent VARCHAR(50),
  parsed_entities JSONB,

  -- Source of the payload — useful while we support multiple webhook formats.
  -- e.g. 'meta', 'gallabox', 'simulator'.
  source VARCHAR(20),

  -- HTTP status returned by the outbound BSP call, when applicable.
  outbound_status INTEGER,

  -- Last raw error or BSP response snippet (capped). Nullable.
  error_message TEXT,

  -- Raw payload (optional; capped via app-level slicing). Useful for
  -- debugging while the parser is rule-based.
  raw_payload JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_messages_phone_idx
  ON whatsapp_messages (phone, created_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_messages_agent_id_idx
  ON whatsapp_messages (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_messages_direction_idx
  ON whatsapp_messages (direction, created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. lead_activities — per-lead audit trail
-- -----------------------------------------------------------------------------
-- Captures every status change, note, reminder, document share, or AI
-- score update on a lead. Required by the engagement-score logic and by
-- the Lead Detail screen (#13 in the architecture PDF).

CREATE TABLE IF NOT EXISTS lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  -- The actor (broker or system). NULL means "system".
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- e.g. 'created', 'status_changed', 'note', 'reminder_set',
  --      'document_shared', 'ai_score_updated'.
  activity_type VARCHAR(40) NOT NULL,

  -- Human-readable description for the timeline UI.
  description TEXT NOT NULL,

  -- Optional structured before/after snapshot (e.g. status changes).
  old_value TEXT,
  new_value TEXT,

  -- Free-form metadata (e.g. {"channel": "whatsapp"}).
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_activities_lead_id_idx
  ON lead_activities (lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS lead_activities_actor_id_idx
  ON lead_activities (actor_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 5. Cleanup of the diagnostics hack
-- -----------------------------------------------------------------------------
-- Remove the stale "Webhook Debug Log" row that the previous webhook
-- code upserted into the profiles table. Safe no-op if it doesn't exist.

DELETE FROM profiles
WHERE name = 'Webhook Debug Log'
  AND phone = '+91 99999 99999'
  AND role = 'admin'
  AND email IS NULL
  AND cp_id IS NULL;
-- Note: the seeded 'Ops Admin Verification' admin row also lives at
-- '+91 99999 99999' but has email/cp_id set, so it survives the DELETE.
