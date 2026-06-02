-- super_builder_events: events created by super builders targeting builders, agents, or both
CREATE TABLE IF NOT EXISTS super_builder_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  target_audience TEXT NOT NULL DEFAULT 'both' CHECK (target_audience IN ('builders', 'agents', 'both')),
  target_locations TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_super_builder_events_created_by ON super_builder_events(created_by);

-- Add target_locations column to events table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'target_locations') THEN
    ALTER TABLE events ADD COLUMN target_locations TEXT[] DEFAULT '{}';
  END IF;
END $$;
