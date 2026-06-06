-- 0010_add_builder_parent_id.sql
-- Add parent_id column to profiles to establish parent-child relationship between super_builders and builders.

-- Ensure super_builder and super_admin roles exist in the user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_builder';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_parent_id
  ON profiles (parent_id)
  WHERE parent_id IS NOT NULL;

