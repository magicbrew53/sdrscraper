export type MqsStatus = 'pending' | 'Fit' | 'Maybe' | 'Not a Fit'
export type UploadStatus = 'processing' | 'complete' | 'failed'
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'failed' | 'partial'

export interface Upload {
  id: string
  filename: string
  uploaded_by: string
  total_contacts: number
  classified_count: number
  status: UploadStatus
  created_at: string
  completed_at: string | null
  // v2.1 stats (computed in query)
  fit_count?: number
  maybe_count?: number
  not_a_fit_count?: number
}

export interface Contact {
  id: string
  upload_id: string
  first_name: string | null
  last_name: string | null
  title: string | null
  company_name: string | null
  industry: string | null
  keywords: string | null
  email: string | null
  email_status: string | null
  work_phone: string | null
  mobile_phone: string | null
  corporate_phone: string | null
  linkedin_url: string | null
  website: string | null
  company_linkedin_url: string | null
  city: string | null
  state: string | null
  country: string | null
  employee_count: string | null
  seniority: string | null
  departments: string | null
  raw_apollo_data: Record<string, string> | null
  mqs_status: MqsStatus
  mqs_niche: string | null
  mqs_reason: string | null
  mqs_confidence: number | null
  override_status: string | null
  override_niche: string | null
  override_reason: string | null
  overridden_by: string | null
  overridden_at: string | null
  created_at: string
  // Verification
  verification_status: VerificationStatus
  verification_completed_at: string | null
  website_alive: boolean | null
  website_http_status: number | null
  website_redirect_url: string | null
  website_checked_at: string | null
  company_active: boolean | null
  company_active_confidence: number | null
  company_active_signals: string | null
  company_checked_at: string | null
  person_verified: boolean | null
  person_verified_confidence: number | null
  person_current_title: string | null
  person_verified_source: string | null
  person_checked_at: string | null
  dm_score: number | null
  dm_reasoning: string | null
  dm_checked_at: string | null
  pre_verification_status: string | null
  pre_verification_niche: string | null
  auto_downgraded: boolean | null
  auto_downgrade_reason: string | null
  // V2.1
  call_priority: number | null
  is_duplicate: boolean | null
  duplicate_of_id: string | null
  duplicate_upload_filename: string | null
  last_exported_at: string | null
  export_count: number | null
  // Computed by query
  company_contact_count?: number
}

export interface ContactsQuery {
  upload_id?: string
  status?: string
  niche?: string
  industry?: string
  search?: string
  verification_status?: string
  hide_duplicates?: boolean
  exported?: string
  min_confidence?: number
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
  page?: number
  per_page?: number
}

export interface ClassificationResult {
  index: number
  status: 'Fit' | 'Maybe' | 'Not a Fit'
  niche: string
  confidence: number
  reason: string
}

export const MQS_NICHES = [
  'SDR Outsourcing',
  'Behavioral Health',
  'Veterinary Medicine',
  'Hospice',
  'Child Welfare',
  'Financial Advisory',
  'Nurse Telephone Triage',
  'Training Companies',
] as const

export type MqsNiche = typeof MQS_NICHES[number]