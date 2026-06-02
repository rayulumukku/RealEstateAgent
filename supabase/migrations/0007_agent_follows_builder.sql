-- agent_follows_builder: tracks which agents follow which builders/super_builders
CREATE TABLE IF NOT EXISTS agent_follows_builder (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  builder_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, builder_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_follows_builder_agent ON agent_follows_builder(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_follows_builder_builder ON agent_follows_builder(builder_id);
