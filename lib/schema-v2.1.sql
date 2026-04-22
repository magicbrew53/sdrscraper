-- V2.1: Call priority, duplicate detection, export tracking
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS call_priority REAL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS duplicate_of_id UUID REFERENCES contacts(id);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS duplicate_upload_filename TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_exported_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS export_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_is_duplicate ON contacts(is_duplicate);
CREATE INDEX IF NOT EXISTS idx_contacts_call_priority ON contacts(call_priority DESC NULLS LAST);