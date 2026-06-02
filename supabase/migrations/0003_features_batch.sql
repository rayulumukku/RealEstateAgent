-- =============================================================================
-- Migration: 0003_features_batch
-- Purpose: Tables and columns for features #1–#11
--
--   1. event_invitations — agent accept/decline event invitations
--   2. (extended KYC — already in profiles, no schema change needed)
--   3. (builder inventory — already in inventory_units, add more columns)
--   4. client_inquiries — client doubts → connect to agent
--   5. (reminders scheduling — remind_at already added in 0001)
--   6. project_follows — agent follows specific projects
--   7. (documents already have project_id FK — just need UI filtering)
--   8. brochure_sends / brochure_views — track WhatsApp brochure delivery
--   9. event_attendances — QR-based attendance logging
--  10. (same as #4 — client_inquiries)
--  11. app_followers — collect name + email for app updates
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. event_invitations — agent can accept or decline event invites
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  agent_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'accepted', 'declined')),
  responded_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, agent_id)
);

CREATE INDEX IF NOT EXISTS event_invitations_agent_idx
  ON event_invitations (agent_id, status);

CREATE INDEX IF NOT EXISTS event_invitations_event_idx
  ON event_invitations (event_id, status);

-- -----------------------------------------------------------------------------
-- 6. project_follows — agent follows/unfollows projects
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_follows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, project_id)
);

CREATE INDEX IF NOT EXISTS project_follows_agent_idx
  ON project_follows (agent_id);

CREATE INDEX IF NOT EXISTS project_follows_project_idx
  ON project_follows (project_id);

-- -----------------------------------------------------------------------------
-- 8. brochure_sends + brochure_views — track WhatsApp brochure delivery
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brochure_sends (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  sent_to_phone VARCHAR(20) NOT NULL,
  sent_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  channel     VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brochure_sends_doc_idx
  ON brochure_sends (document_id, created_at DESC);

CREATE TABLE IF NOT EXISTS brochure_views (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  viewer_phone VARCHAR(20),
  viewer_agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brochure_views_doc_idx
  ON brochure_views (document_id, viewed_at DESC);

-- -----------------------------------------------------------------------------
-- 9. event_attendances — QR-based attendance at events/webinars
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_attendances (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  agent_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scanned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  qr_code     VARCHAR(255),
  UNIQUE(event_id, agent_id)
);

CREATE INDEX IF NOT EXISTS event_attendances_event_idx
  ON event_attendances (event_id);

-- -----------------------------------------------------------------------------
-- 4 & 10. client_inquiries — client has doubts, connect to agent
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_inquiries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name VARCHAR(100) NOT NULL,
  client_phone VARCHAR(20) NOT NULL,
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  question    TEXT NOT NULL,
  assigned_agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'assigned', 'resolved')),
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_inquiries_status_idx
  ON client_inquiries (status, created_at DESC);

CREATE INDEX IF NOT EXISTS client_inquiries_agent_idx
  ON client_inquiries (assigned_agent_id, status);

-- -----------------------------------------------------------------------------
-- 11. app_followers — collect name + email for app update notifications
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_followers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  phone       VARCHAR(20),
  source      VARCHAR(50) DEFAULT 'landing_page',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_followers_email_idx
  ON app_followers (email);

-- -----------------------------------------------------------------------------
-- 3. Extend inventory_units with more apartment/flat details
-- -----------------------------------------------------------------------------
ALTER TABLE inventory_units
  ADD COLUMN IF NOT EXISTS floor_number INTEGER,
  ADD COLUMN IF NOT EXISTS tower VARCHAR(50),
  ADD COLUMN IF NOT EXISTS facing VARCHAR(20),
  ADD COLUMN IF NOT EXISTS carpet_area_sqft INTEGER,
  ADD COLUMN IF NOT EXISTS price NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS bhk_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS possession_date DATE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- -----------------------------------------------------------------------------
-- Extend events table with QR code field for attendance
-- -----------------------------------------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS qr_code_data VARCHAR(500),
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(30) DEFAULT 'meet'
    CHECK (event_type IN ('meet', 'launch', 'webinar'));

-- -----------------------------------------------------------------------------
-- Add download_count to documents for brochure tracking
-- -----------------------------------------------------------------------------
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS send_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
