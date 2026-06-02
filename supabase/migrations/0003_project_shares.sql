-- project_shares table: tracks which projects are shared with which builders
-- by the super_builder role.

CREATE TABLE IF NOT EXISTS project_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  builder_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, builder_id)
);

-- Index for fast lookups by super builder
CREATE INDEX IF NOT EXISTS idx_project_shares_shared_by ON project_shares(shared_by);

-- Index for fast lookups by builder
CREATE INDEX IF NOT EXISTS idx_project_shares_builder_id ON project_shares(builder_id);

-- Index for finding all shares for a project
CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_project_shares_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_project_shares_updated_at
  BEFORE UPDATE ON project_shares
  FOR EACH ROW
  EXECUTE FUNCTION update_project_shares_updated_at();
