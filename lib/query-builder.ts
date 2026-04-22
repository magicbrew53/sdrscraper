// Shared filter builder used by contacts GET, export, verify, and results page

export interface FilterParams {
  upload_id?: string | null
  status?: string | null
  niche?: string | null
  industry?: string | null
  search?: string | null
  verification_status?: string | null
  hide_duplicates?: boolean
  exported?: string | null   // 'exported' | 'not_exported'
  min_confidence?: number | null
}

export function buildContactsWhere(params: FilterParams, includeIndustry = true) {
  const conditions: string[] = []
  const args: unknown[] = []
  let idx = 1

  if (params.upload_id) {
    conditions.push(`upload_id = $${idx++}`)
    args.push(params.upload_id)
  }
  if (params.status && params.status !== 'All') {
    conditions.push(`COALESCE(override_status, mqs_status) = $${idx++}`)
    args.push(params.status)
  }
  if (params.niche && params.niche !== 'All') {
    conditions.push(`COALESCE(override_niche, mqs_niche) = $${idx++}`)
    args.push(params.niche)
  }
  if (includeIndustry && params.industry && params.industry !== 'All') {
    conditions.push(`industry = $${idx++}`)
    args.push(params.industry)
  }
  if (params.verification_status && params.verification_status !== 'All') {
    conditions.push(`verification_status = $${idx++}`)
    args.push(params.verification_status)
  }
  if (params.hide_duplicates) {
    conditions.push(`(is_duplicate IS NULL OR is_duplicate = false)`)
  }
  if (params.exported === 'exported') {
    conditions.push(`last_exported_at IS NOT NULL`)
  } else if (params.exported === 'not_exported') {
    conditions.push(`last_exported_at IS NULL`)
  }
  if (params.min_confidence != null && params.min_confidence > 0) {
    conditions.push(`mqs_confidence >= $${idx++}`)
    args.push(params.min_confidence / 100)
  }
  if (params.search) {
    conditions.push(
      `(company_name ILIKE $${idx} OR first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR keywords ILIKE $${idx})`
    )
    args.push(`%${params.search}%`)
    idx++
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  return { where, args, nextIdx: idx }
}

// Call priority as a SQL expression (0–1 range)
export const PRIORITY_EXPR = `
  ROUND((
    COALESCE(mqs_confidence, 0) * 0.3 +
    COALESCE(dm_score, 0) * 0.4 +
    CASE verification_status
      WHEN 'verified' THEN
        CASE WHEN (person_verified = false AND COALESCE(person_verified_confidence, 0) >= 0.8)
                  OR COALESCE(dm_score, 1) < 0.5
             THEN 0.7 ELSE 1.0 END
      WHEN 'partial' THEN 0.7
      WHEN 'failed'  THEN 0.0
      ELSE 0.3
    END * 0.3
  ) * 100)::integer
`

// Standard SELECT columns for contact lists
export const CONTACT_LIST_COLS = `
  id, upload_id, first_name, last_name, title, company_name, industry,
  email, email_status, work_phone, mobile_phone, corporate_phone,
  linkedin_url, website, city, state, country, employee_count, seniority, departments,
  mqs_status, mqs_niche, mqs_reason, mqs_confidence,
  override_status, override_niche, override_reason, overridden_by, overridden_at,
  verification_status, verification_completed_at,
  website_alive, website_http_status, website_redirect_url,
  company_active, company_active_confidence,
  person_verified, person_verified_confidence, person_current_title,
  dm_score, auto_downgraded, pre_verification_status,
  is_duplicate, duplicate_upload_filename, last_exported_at, export_count,
  ${PRIORITY_EXPR} AS call_priority,
  COUNT(*) OVER (PARTITION BY LOWER(TRIM(COALESCE(company_name, '')))) AS company_contact_count
`