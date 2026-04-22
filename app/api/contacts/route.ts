import { NextRequest, NextResponse } from 'next/server'
import { getDb, query } from '@/lib/db'
import { buildContactsWhere, CONTACT_LIST_COLS } from '@/lib/query-builder'

const VALID_SORT = ['mqs_status', 'mqs_niche', 'company_name', 'industry', 'mqs_confidence', 'dm_score', 'call_priority']

export async function GET(req: NextRequest) {
  const db = getDb()
  const p = req.nextUrl.searchParams

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

  const sortBy = VALID_SORT.includes(p.get('sort_by') || '') ? p.get('sort_by')! : 'call_priority'
  const sortDir = p.get('sort_dir') === 'asc' ? 'ASC' : 'DESC'
  const page = Math.max(1, parseInt(p.get('page') || '1'))
  const perPage = Math.min(100, parseInt(p.get('per_page') || '50'))
  const offset = (page - 1) * perPage

  const { where, args, nextIdx: idx } = buildContactsWhere(filters)

  const orderClause =
    sortBy === 'mqs_status'
      ? `CASE COALESCE(override_status, mqs_status) WHEN 'Fit' THEN 1 WHEN 'Maybe' THEN 2 WHEN 'Not a Fit' THEN 3 ELSE 4 END, mqs_confidence DESC NULLS LAST`
      : sortBy === 'call_priority'
      ? `call_priority DESC NULLS LAST`
      : `${sortBy} ${sortDir} NULLS LAST`

  const [rows, countRows] = await Promise.all([
    query(db,
      `SELECT ${CONTACT_LIST_COLS} FROM contacts ${where}
       ORDER BY ${orderClause}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...args, perPage, offset]
    ),
    query<{ total: string }>(db, `SELECT COUNT(*) as total FROM contacts ${where}`, args),
  ])

  const total = parseInt(countRows[0].total)
  return NextResponse.json({ contacts: rows, total, page, perPage, totalPages: Math.ceil(total / perPage) })
}