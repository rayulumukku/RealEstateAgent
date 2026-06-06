-- 0011_add_sub_builder_requests.sql
-- Create table to track Super Builder requests to link existing builders

CREATE TABLE IF NOT EXISTS sub_builder_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_builder_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  builder_phone TEXT NOT NULL,
  builder_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(super_builder_id, builder_phone)
);

CREATE INDEX IF NOT EXISTS idx_sub_builder_req_status ON sub_builder_requests(status);
