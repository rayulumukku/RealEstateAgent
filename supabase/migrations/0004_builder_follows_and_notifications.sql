-- builder_follows: tracks which builders follow which super builders
CREATE TABLE IF NOT EXISTS builder_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, followed_id)
);

CREATE INDEX IF NOT EXISTS idx_builder_follows_follower ON builder_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_builder_follows_followed ON builder_follows(followed_id);

-- follow_notifications: real-time notifications for super builders
-- when builders follow or unfollow them
CREATE TABLE IF NOT EXISTS follow_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_builder_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  builder_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  builder_name TEXT NOT NULL DEFAULT '',
  builder_phone TEXT NOT NULL DEFAULT '',
  builder_company TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL CHECK (action IN ('followed', 'unfollowed')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follow_notifs_super_builder ON follow_notifications(super_builder_id);
CREATE INDEX IF NOT EXISTS idx_follow_notifs_unread ON follow_notifications(super_builder_id, is_read) WHERE is_read = false;

-- Enable Supabase Realtime on follow_notifications table
-- This allows the super builder's frontend to subscribe to new notifications in real time
ALTER PUBLICATION supabase_realtime ADD TABLE follow_notifications;
