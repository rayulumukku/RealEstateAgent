-- -------------------------------------------------------------
-- AGENTSAPP DATABASE SCHEMA & INITIAL DEMO SEED DATA
-- Run this script inside your Supabase SQL Editor
-- -------------------------------------------------------------

-- 1. DROP EXISTING TABLES/ENUMS IF ANY (Clean Slate)
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;
DROP TABLE IF EXISTS referrals CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS rsvps CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS webinars CASCADE;
DROP TABLE IF EXISTS reminders CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS inventory_units CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS lead_status CASCADE;
DROP TYPE IF EXISTS unit_status CASCADE;
DROP TYPE IF EXISTS unit_type CASCADE;
DROP TYPE IF EXISTS verification_status CASCADE;

-- 2. CREATE CUSTOM TYPES/ENUMS
CREATE TYPE user_role AS ENUM ('agent', 'builder', 'super_builder', 'admin', 'super_admin', 'verification', 'operations');
CREATE TYPE lead_status AS ENUM ('new', 'interested', 'site_visit', 'negotiation', 'closed', 'lost');
CREATE TYPE unit_status AS ENUM ('available', 'booked', 'sold');
CREATE TYPE unit_type AS ENUM ('apartment', 'villa', 'plot', 'commercial');
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');

-- 3. CREATE TABLES

-- Profiles Table (Can reference Supabase auth.users or stand alone for simplicity in sandbox)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  role user_role DEFAULT 'agent'::user_role NOT NULL,
  name VARCHAR(100) NOT NULL,
  agency_name VARCHAR(100),
  email VARCHAR(100),
  rera_number VARCHAR(100),
  status verification_status DEFAULT 'pending'::verification_status NOT NULL,
  cp_id VARCHAR(50) UNIQUE,
  points INTEGER DEFAULT 0 NOT NULL,
  credits INTEGER DEFAULT 0 NOT NULL,
  referrals_count INTEGER DEFAULT 0 NOT NULL,
  rejection_reason TEXT,
  location VARCHAR(100) DEFAULT 'Hyderabad',
  parent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Projects Table
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  location VARCHAR(100) NOT NULL,
  price_range VARCHAR(100) NOT NULL,
  type unit_type NOT NULL,
  developer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  details JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Inventory Units Table
CREATE TABLE inventory_units (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  unit_name VARCHAR(100) NOT NULL,
  status unit_status DEFAULT 'available'::unit_status NOT NULL,
  details JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Leads Table
CREATE TABLE leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100),
  status lead_status DEFAULT 'new'::lead_status NOT NULL,
  requirement VARCHAR(100), -- e.g., '3 BHK'
  location VARCHAR(100), -- e.g., 'Kokapet'
  budget VARCHAR(50), -- e.g., '< 2cr'
  details JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Reminders Table
CREATE TABLE reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  scheduled_time VARCHAR(100) NOT NULL, -- Simplified string date representation
  is_completed BOOLEAN DEFAULT FALSE NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium' NOT NULL, -- high, medium, low
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Webinars Table
CREATE TABLE webinars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  scheduled_time VARCHAR(100) NOT NULL,
  reward VARCHAR(150), -- e.g. '₹500 Amazon Voucher'
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Events Table (Launches and CP Meets)
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  date VARCHAR(100) NOT NULL,
  location VARCHAR(200) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- RSVPs Table
CREATE TABLE rsvps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  qr_code VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(event_id, agent_id)
);

-- Document Vault Table
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- e.g. 'Brochure', 'Price List', 'Agreement'
  url VARCHAR(255) NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Referrals Table
CREATE TABLE referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  referred_name VARCHAR(100) NOT NULL,
  referred_phone VARCHAR(20) NOT NULL,
  status verification_status DEFAULT 'pending'::verification_status NOT NULL,
  points_awarded INTEGER DEFAULT 0 NOT NULL,
  date VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Coupons Table
CREATE TABLE coupons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(200) NOT NULL,
  code VARCHAR(50) NOT NULL,
  sponsor VARCHAR(100) NOT NULL,
  expiry VARCHAR(100) NOT NULL,
  is_claimed BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Campaigns Table
CREATE TABLE campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  builder_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(200) NOT NULL,
  audience_segment VARCHAR(100) NOT NULL,
  template VARCHAR(100) NOT NULL,
  sent_count INTEGER DEFAULT 0 NOT NULL,
  read_rate FLOAT DEFAULT 0.0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Sub-Builder Association Requests Table
CREATE TABLE sub_builder_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  super_builder_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  builder_phone VARCHAR(20) NOT NULL,
  builder_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(super_builder_id, builder_phone)
);

-- 4. SEED SAMPLE DEMO DATA

-- Seed Profiles (Agents, Builders, Admins)
INSERT INTO profiles (id, phone, role, name, agency_name, email, rera_number, status, cp_id, points, referrals_count, location) VALUES
('b04b8402-9912-4cf4-91eb-7ee37d1d28ab', '+91 98765 43210', 'agent', 'Sreenivas Rao', 'Rao Real Estate Services', 'sreenivas@raorealty.in', 'RERA-HYD-551029', 'approved', 'CP-8402', 1240, 2, 'Kokapet'),
('a01b1111-2222-3333-4444-555555555555', '+91 99011 22334', 'agent', 'Prasad Goud', 'Prasad Estates', 'prasad@goudestates.com', 'RERA-HYD-991024', 'approved', 'CP-1111', 4200, 0, 'Gachibowli'),
('a02b1111-2222-3333-4444-555555555555', '+91 98480 22334', 'agent', 'Vikas Sharma', 'Sharma Realty Group', 'vikas@sharmarealty.in', 'RERA-HYD-881203', 'approved', 'CP-2222', 890, 0, 'Ameerpet'),
('d01b1111-2222-3333-4444-555555555555', '+91 88888 88888', 'builder', 'Prestige Group', 'Prestige Constructions', 'sales@prestigeconstructions.com', NULL, 'approved', 'BLD-1029', 0, 0, 'Bengaluru'),
('ad011111-2222-3333-4444-555555555555', '+91 99999 99999', 'admin', 'Ops Admin Verification', 'agentsapp CP Audits', 'audit@agentsapp.in', NULL, 'approved', 'ADM-9999', 0, 0, 'Hyderabad');

-- Seed Projects (valid hexadecimal prefix 'f01b', 'f02b', 'f03b')
INSERT INTO projects (id, name, location, price_range, type, developer_id, details) VALUES
('f01b1111-2222-3333-4444-555555555555', 'Skyline Heights', 'Kokapet', '₹1.82 Cr Onwards', 'apartment', 'd01b1111-2222-3333-4444-555555555555', '{"amenities": ["Infinity Pool", "Clubhouse", "Gym", "Private Balconies"], "rera": "RERA-HYD-AP-8821"}'),
('f02b1111-2222-3333-4444-555555555555', 'Green Meadows', 'Gachibowli', '₹1.40 Cr Onwards', 'plot', 'd01b1111-2222-3333-4444-555555555555', '{"amenities": ["Water Connection", "Underground Electricity", "Fenced Security"], "rera": "RERA-HYD-PL-5510"}'),
('f03b1111-2222-3333-4444-555555555555', 'Gachibowli Enclave', 'Gachibowli', '₹1.75 Cr Onwards', 'plot', 'd01b1111-2222-3333-4444-555555555555', '{"amenities": ["Water Connection", "Concrete Roads", "Clubhouse Access"], "rera": "RERA-HYD-PL-9912"}');

-- Seed Inventory Units
INSERT INTO inventory_units (project_id, unit_name, status, details) VALUES
('f01b1111-2222-3333-4444-555555555555', 'Flat 402, Block A', 'available', '{"bhk": "3 BHK", "area": "1850 sqft", "floor": 4}'),
('f01b1111-2222-3333-4444-555555555555', 'Flat 1004, Block B', 'available', '{"bhk": "3 BHK", "area": "1900 sqft", "floor": 10}'),
('f01b1111-2222-3333-4444-555555555555', 'Flat 101, Block A', 'sold', '{"bhk": "2 BHK", "area": "1200 sqft", "floor": 1}'),
('f02b1111-2222-3333-4444-555555555555', 'Plot 42', 'available', '{"size": "2400 sqft", "facing": "East", "road_width": "40 feet"}'),
('f02b1111-2222-3333-4444-555555555555', 'Plot 18', 'available', '{"size": "3000 sqft", "facing": "North", "road_width": "60 feet"}');

-- Seed Leads for Sreenivas Rao (valid hexadecimal prefix 'c01b', 'c02b')
INSERT INTO leads (id, agent_id, name, phone, email, status, requirement, location, budget, details) VALUES
('c01b1111-2222-3333-4444-555555555555', 'b04b8402-9912-4cf4-91eb-7ee37d1d28ab', 'Ramesh Kumar', '+91 99123 45678', 'ramesh@gmail.com', 'site_visit', '3 BHK', 'Kokapet', '< ₹2.00 Cr', '{"notes": "Looking for premium skyline views, scheduled site visit for this evening."}'),
('c02b1111-2222-3333-4444-555555555555', 'b04b8402-9912-4cf4-91eb-7ee37d1d28ab', 'Neha Singh', '+91 98450 99122', 'neha@singh.in', 'interested', '2 BHK', 'Financial Dist', '< ₹1.20 Cr', '{"notes": "Requested price sheets and location layout details."}');

-- Seed Reminders for Sreenivas Rao
INSERT INTO reminders (agent_id, lead_id, title, scheduled_time, is_completed, priority) VALUES
('b04b8402-9912-4cf4-91eb-7ee37d1d28ab', 'c01b1111-2222-3333-4444-555555555555', 'Call Ramesh Kumar to confirm 3 BHK Kokapet Site Visit', 'Today, 5:00 PM', false, 'high'),
('b04b8402-9912-4cf4-91eb-7ee37d1d28ab', 'c02b1111-2222-3333-4444-555555555555', 'Send Skyline Heights layout brochure to Neha Singh', 'Today, 6:30 PM', false, 'medium'),
('b04b8402-9912-4cf4-91eb-7ee37d1d28ab', NULL, 'Submit builder commission invoice for closed Prestige deal', 'Tomorrow, 11:30 AM', false, 'high');

-- Seed Webinars
INSERT INTO webinars (title, scheduled_time, reward, details) VALUES
('Prestige Highrise Broker Webinar Launch', 'Today, 8:00 PM', '₹500 Amazon Voucher', 'Virtual session outlining inventory limits, layout details, and channel partner commission structures.');

-- Seed Events
INSERT INTO events (id, title, date, location, description) VALUES
('e01b1111-2222-3333-4444-555555555555', 'Skyline Heights CP Meet', 'June 15, 2026', 'Prestige Grand Ballroom, Hyderabad', 'Developer meet for verified channel partners. Launching tower 3 pricing models and rewards portfolios.');

-- Seed Document Vault
INSERT INTO documents (name, type, url, project_id) VALUES
('Skyline Heights Master Brochure.pdf', 'Brochure', '#', 'f01b1111-2222-3333-4444-555555555555'),
('Skyline Heights Price List Tower A.pdf', 'Price List', '#', 'f01b1111-2222-3333-4444-555555555555'),
('Green Meadows Road Map Layout.pdf', 'Brochure', '#', 'f02b1111-2222-3333-4444-555555555555');

-- Seed Referrals for Sreenivas Rao
INSERT INTO referrals (referrer_id, referred_name, referred_phone, status, points_awarded, date) VALUES
('b04b8402-9912-4cf4-91eb-7ee37d1d28ab', 'Prasad Goud', '+91 99011 22334', 'approved', 500, 'May 10, 2026'),
('b04b8402-9912-4cf4-91eb-7ee37d1d28ab', 'Anil Kumar', '+91 98480 22334', 'pending', 0, 'May 24, 2026');

-- Seed Coupons for Sreenivas Rao
INSERT INTO coupons (agent_id, title, code, sponsor, expiry, is_claimed) VALUES
('b04b8402-9912-4cf4-91eb-7ee37d1d28ab', '₹500 Amazon Gift Voucher', 'AMZ-9912-GET', 'Prestige Group', 'June 10, 2026', false),
('b04b8402-9912-4cf4-91eb-7ee37d1d28ab', '₹1,000 Uber Ride Coupon', 'UBR-COMM-RIDE', 'Lodha Builders', 'June 25, 2026', true);

-- Seed Campaigns for Builder
INSERT INTO campaigns (builder_id, name, audience_segment, template, sent_count, read_rate) VALUES
('d01b1111-2222-3333-4444-555555555555', 'Tower 3 Launch Blast', 'Hyderabad Active Brokers', 'Rich Media + Price sheet PDF', 450, 92.5);
