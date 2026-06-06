-- supabase/migrations/0012_sub_builder_agent_assignments.sql
CREATE TABLE IF NOT EXISTS sub_builder_agent_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_builder_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sub_builder_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sub_builder_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_sub_builder_agent_assignments_sb ON sub_builder_agent_assignments(sub_builder_id);
CREATE INDEX IF NOT EXISTS idx_sub_builder_agent_assignments_agent ON sub_builder_agent_assignments(agent_id);
