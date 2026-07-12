-- Add reward_points column to channel_partners table
ALTER TABLE channel_partners ADD COLUMN IF NOT EXISTS reward_points INTEGER DEFAULT 100;
