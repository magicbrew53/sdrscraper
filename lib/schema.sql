CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  uploaded_by TEXT DEFAULT 'rico',
  total_contacts INTEGER NOT NULL,
  classified_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,

  first_name TEXT,
  last_name TEXT,
  title TEXT,
  company_name TEXT,
  industry TEXT,
  keywords TEXT,
  email TEXT,
  email_status TEXT,
  work_phone TEXT,
  mobile_phone TEXT,
  corporate_phone TEXT,
  linkedin_url TEXT,
  website TEXT,
  company_linkedin_url TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  employee_count TEXT,
  seniority TEXT,
  departments TEXT,
  raw_apollo_data JSONB,

  mqs_status TEXT NOT NULL DEFAULT 'pending',
  mqs_niche TEXT DEFAULT 'None',
  mqs_reason TEXT,
  mqs_confidence REAL,

  override_status TEXT,
  override_niche TEXT,
  override_reason TEXT,
  overridden_by TEXT,
  overridden_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_upload_id ON contacts(upload_id);
CREATE INDEX IF NOT EXISTS idx_contacts_mqs_status ON contacts(mqs_status);
CREATE INDEX IF NOT EXISTS idx_contacts_mqs_niche ON contacts(mqs_niche);
CREATE INDEX IF NOT EXISTS idx_contacts_industry ON contacts(industry);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_name);