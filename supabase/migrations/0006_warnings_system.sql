-- warnings: messages sent by super admin to specific roles or users
CREATE TABLE IF NOT EXISTS warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  target_roles TEXT[] NOT NULL DEFAULT '{}',
  target_user_ids UUID[] NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warnings_created_at ON warnings(created_at DESC);

-- warning_acknowledgments: tracks which users have acknowledged which warnings
CREATE TABLE IF NOT EXISTS warning_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warning_id UUID NOT NULL REFERENCES warnings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(warning_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_warning_ack_user ON warning_acknowledgments(user_id);
CREATE INDEX IF NOT EXISTS idx_warning_ack_warning ON warning_acknowledgments(warning_id);

-- Enable Supabase Realtime on warnings table for instant popup delivery
ALTER PUBLICATION supabase_realtime ADD TABLE warnings;
