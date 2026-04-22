import { NextRequest, NextResponse } from 'next/server'
import { getDb, query, pgUuidArray } from '@/lib/db'
import { buildContactsWhere, PRIORITY_EXPR } from '@/lib/query-builder'

function esc(val: unknown): string {
  if (val === null || val === undefined) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

function boolStr(v: unknown) {
  return v === true ? 'yes' : v === false ? 'no' : ''
}

function pctStr(v: unknown) {
  return v != null ? Math.round((v as number) * 100) + '%' : ''
}

export async function GET(req: NextRequest) {
  const db = getDb()
  const p = req.nextUrl.searchParams

  const selectedIds = p.get('ids')?.split(',').filter(Boolean) ?? []
  const newOnly = p.get('new_only') === 'true'

  const filters = {
    upload_id: p.get('upload_id'),
    status: p.get('status'),
    niche: p.get('niche'),
    industry: p.get('industry'),
    search: p.get('search'),
    verification_status: p.get('verification_status'),
    hide_duplicates: p.get('hide_duplicates') === 'true',
    exported: p.get('exported'),
    min_confidence: p.get('min_confidence') ? Number(p.get('min_confidence')) : null,
  }

  let rows: Record<string, unknown>[]

  if (selectedIds.length > 0) {
    let idWhere = `WHERE id = ANY($1::uuid[])`
    if (newOnly) idWhere += ` AND last_exported_at IS NULL`
    rows = await query<Record<string, unknown>>(db,
      `SELECT *, ${PRIORITY_EXPR} AS call_priority FROM contacts ${idWhere}
       ORDER BY call_priority DESC NULLS LAST`,
      [pgUuidArray(selectedIds)]
    )
  } else {
    const { where, args } = buildContactsWhere(newOnly ? { ...filters, exported: 'not_exported' } : filters)
    rows = await query<Record<string, unknown>>(db,
      `SELECT *, ${PRIORITY_EXPR} AS call_priority FROM contacts ${where}
       ORDER BY call_priority DESC NULLS LAST`,
      args
    )
  }

  // Update export tracking
  const ids = rows.map(r => r.id as string)
  if (ids.length > 0) {
    await query(db,
      `UPDATE contacts SET
        last_exported_at = now(),
        export_count = COALESCE(export_count, 0) + 1
       WHERE id = ANY($1::uuid[])`,
      [pgUuidArray(ids)]
    )
  }

  // Apollo-compatible column headers (exact Apollo names), then MQS columns
  const headers = [
    'First Name', 'Last Name', 'Title', 'Company Name', 'Email', 'Email Status',
    'Work Direct Phone', 'Mobile Phone', 'Corporate Phone',
    'Person Linkedin Url', 'Website', 'Company Linkedin Url',
    'City', 'State', 'Country', '# Employees', 'Industry', 'Keywords',
    'Seniority', 'Departments',
    // MQS
    'MQS Status', 'MQS Niche', 'MQS Confidence', 'MQS Reason',
    'Verified', 'Website Alive', 'Company Active', 'Company Active Confidence',
    'Person Verified', 'Person Current Title',
    'DM Score', 'DM Reasoning',
    'Auto Downgraded', 'Call Priority',
    'Previously Exported', 'Export Count',
  ]

  const csvLines = [
    headers.join(','),
    ...rows.map(r => [
      r.first_name, r.last_name, r.title, r.company_name, r.email, r.email_status,
      r.work_phone, r.mobile_phone, r.corporate_phone,
      r.linkedin_url, r.website, r.company_linkedin_url,
      r.city, r.state, r.country, r.employee_count, r.industry, r.keywords,
      r.seniority, r.departments,
      r.override_status || r.mqs_status,
      r.override_niche || r.mqs_niche,
      pctStr(r.mqs_confidence),
      r.mqs_reason,
      r.verification_status,
      boolStr(r.website_alive),
      boolStr(r.company_active),
      pctStr(r.company_active_confidence),
      r.person_verified === null ? 'unknown' : boolStr(r.person_verified),
      r.person_current_title,
      pctStr(r.dm_score),
      r.dm_reasoning,
      boolStr(r.auto_downgraded),
      r.call_priority != null ? String(r.call_priority) : '',
      r.last_exported_at ? 'yes' : 'no',
      r.export_count ?? 0,
    ].map(esc).join(','))
  ]

  // Build filename from active filters
  const statusSlug = (filters.status && filters.status !== 'All')
    ? filters.status.toLowerCase().replace(/\s+/g, '-')
    : 'all'
  const nicheSlug = (filters.niche && filters.niche !== 'All')
    ? filters.niche.toLowerCase().replace(/\s+/g, '-')
    : 'all-niches'
  const verifSlug = (filters.verification_status && filters.verification_status !== 'All')
    ? filters.verification_status
    : 'all'
  const confSlug = filters.min_confidence ? `_${filters.min_confidence}pct` : ''
  const date = new Date().toISOString().slice(0, 10)
  const filename = `mqs_${statusSlug}_${nicheSlug}_${verifSlug}${confSlug}_${date}.csv`

  return new NextResponse(csvLines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}