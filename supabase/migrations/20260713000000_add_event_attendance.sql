-- Add attendance_code and attendance_points columns to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS attendance_code VARCHAR(50);
ALTER TABLE events ADD COLUMN IF NOT EXISTS attendance_points INTEGER DEFAULT 500;

-- Create table to track event check-ins/attendance (preventing multiple redemptions)
CREATE TABLE IF NOT EXISTS event_attendance_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  points_awarded INTEGER DEFAULT 500,
  UNIQUE(event_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_event_attendance_checkins_event ON event_attendance_checkins(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendance_checkins_agent ON event_attendance_checkins(agent_id);
