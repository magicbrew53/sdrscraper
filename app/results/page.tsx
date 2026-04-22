import { getDb, query } from '@/lib/db'
import { buildContactsWhere, CONTACT_LIST_COLS } from '@/lib/query-builder'
import ResultsShell from '@/components/ResultsShell'
import type { Contact, Upload } from '@/lib/types'

interface SearchParams {
  upload_id?: string
  status?: string
  niche?: string
  industry?: string
  search?: string
  verification_status?: string
  hide_duplicates?: string
  exported?: string
  min_confidence?: string
  sort_by?: string
  sort_dir?: string
  page?: string
}

async function getUploads(): Promise<Upload[]> {
  const db = getDb()
  return query<Upload>(db,
    `SELECT id, filename, uploaded_by, total_contacts, classified_count, status, created_at, completed_at
     FROM uploads ORDER BY created_at DESC LIMIT 50`
  )
}

async function getIndustries(filters: SearchParams): Promise<string[]> {
  const db = getDb()
  // industry filter excluded so the dropdown still shows all options
  const noIndustry = {
    upload_id: filters.upload_id,
    status: filters.status,
    niche: filters.niche,
    search: filters.search,
    verification_status: filters.verification_status,
    hide_duplicates: filters.hide_duplicates !== 'false',
    exported: filters.exported,
    min_confidence: filters.min_confidence ? Number(filters.min_confidence) : null,
  }
  const { where, args } = buildContactsWhere(noIndustry)
  const base = where ? `${where} AND industry IS NOT NULL` : `WHERE industry IS NOT NULL`
  const rows = await query<{ industry: string }>(db,
    `SELECT DISTINCT industry FROM contacts ${base} ORDER BY industry`, args
  )
  return rows.map(r => r.industry)
}

async function getContacts(params: SearchParams) {
  const db = getDb()

  const VALID_SORT = ['mqs_status', 'mqs_niche', 'company_name', 'industry', 'mqs_confidence', 'dm_score', 'call_priority']
  const sortBy = VALID_SORT.includes(params.sort_by || '') ? params.sort_by! : 'call_priority'
  const sortDir = params.sort_dir === 'asc' ? 'ASC' : 'DESC'
  const page = Math.max(1, parseInt(params.page || '1'))
  const perPage = 50
  const offset = (page - 1) * perPage

  const orderClause =
    sortBy === 'mqs_status'
      ? `CASE COALESCE(override_status, mqs_status) WHEN 'Fit' THEN 1 WHEN 'Maybe' THEN 2 WHEN 'Not a Fit' THEN 3 ELSE 4 END, mqs_confidence DESC NULLS LAST`
      : `${sortBy} ${sortDir} NULLS LAST`

  const filters = {
    upload_id: params.upload_id,
    status: params.status,
    niche: params.niche,
    industry: params.industry,
    search: params.search,
    verification_status: params.verification_status,
    hide_duplicates: params.hide_duplicates !== 'false',
    exported: params.exported,
    min_confidence: params.min_confidence ? Number(params.min_confidence) : null,
  }

  const { where, args } = buildContactsWhere(filters)

  const [contacts, countRows] = await Promise.all([
    query<Contact>(db,
      `SELECT ${CONTACT_LIST_COLS} FROM contacts ${where}
       ORDER BY ${orderClause}
       LIMIT $${args.length + 1} OFFSET $${args.length + 2}`,
      [...args, perPage, offset]
    ),
    query<{ total: string }>(db, `SELECT COUNT(*) as total FROM contacts ${where}`, args),
  ])

  const total = parseInt(countRows[0].total)
  return { contacts, total, page, perPage, totalPages: Math.ceil(total / perPage) }
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const [uploads, data, industries] = await Promise.all([
    getUploads(),
    getContacts(params),
    getIndustries(params),
  ])

  const minConfidence = params.min_confidence ? Number(params.min_confidence) : 65

  return (
    <ResultsShell
      contacts={data.contacts}
      total={data.total}
      page={data.page}
      totalPages={data.totalPages}
      uploads={uploads}
      industries={industries}
      searchParams={params as Record<string, string>}
      minConfidence={minConfidence}
    />
  )
}