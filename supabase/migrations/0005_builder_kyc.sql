-- Migration: Builder KYC / Project Details
-- Stores project info submitted by builders during registration.

CREATE TABLE IF NOT EXISTS builder_projects_kyc (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  builder_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  project_name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  city VARCHAR(100),
  price_estimate VARCHAR(100),
  company_details TEXT,
  brochure_url TEXT,
  brochure_file_name VARCHAR(255),
  submitted_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE builder_projects_kyc DISABLE ROW LEVEL SECURITY;
