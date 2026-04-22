-- V2: Verification columns on contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS verification_started_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS verification_completed_at TIMESTAMPTZ;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS website_alive BOOLEAN;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS website_http_status INTEGER;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS website_redirect_url TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS website_checked_at TIMESTAMPTZ;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_active BOOLEAN;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_active_confidence REAL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_active_signals TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_checked_at TIMESTAMPTZ;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS person_verified BOOLEAN;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS person_verified_confidence REAL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS person_current_title TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS person_verified_source TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS person_checked_at TIMESTAMPTZ;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS dm_score REAL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS dm_reasoning TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS dm_checked_at TIMESTAMPTZ;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS pre_verification_status TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS pre_verification_niche TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS auto_downgraded BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS auto_downgrade_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_contacts_verification_status ON contacts(verification_status);
CREATE INDEX IF NOT EXISTS idx_contacts_website_alive ON contacts(website_alive);
CREATE INDEX IF NOT EXISTS idx_contacts_dm_score ON contacts(dm_score);

-- Job tracking table for polling
CREATE TABLE IF NOT EXISTS verification_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES uploads(id),
  filters JSONB NOT NULL DEFAULT '{}',
  total INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  current_step TEXT DEFAULT 'website',
  website_complete INTEGER DEFAULT 0,
  company_complete INTEGER DEFAULT 0,
  person_complete INTEGER DEFAULT 0,
  dm_complete INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);