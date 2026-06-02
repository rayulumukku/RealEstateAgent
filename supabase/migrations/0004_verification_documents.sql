-- Migration: Verification Documents
-- Stores metadata about documents uploaded by agents for KYC verification.
-- Actual files are stored in Supabase Storage bucket "verification-docs".

CREATE TABLE IF NOT EXISTS verification_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  doc_type VARCHAR(50) NOT NULL, -- 'rera_certificate', 'pan_card', 'aadhaar_card'
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL, -- Supabase Storage public URL or signed URL path
  file_size INTEGER, -- bytes
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Disable RLS so service role can read/write without issues
ALTER TABLE verification_documents DISABLE ROW LEVEL SECURITY;

-- Add a 'docs_required' status option to profiles
-- (profiles.status can now be: 'pending', 'docs_required', 'docs_uploaded', 'approved', 'rejected')

-- Create the storage bucket for verification documents (run this manually in Supabase dashboard if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('verification-docs', 'verification-docs', true);
