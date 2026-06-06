-- Add credits column to profiles for builder billing/subscription system
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0 NOT NULL;
