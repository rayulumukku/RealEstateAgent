-- add is_rera_approved column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_rera_approved BOOLEAN DEFAULT FALSE NOT NULL;
