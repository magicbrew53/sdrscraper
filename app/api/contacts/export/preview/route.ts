import { NextRequest, NextResponse } from 'next/server'
import { getDb, query } from '@/lib/db'
import { buildContactsWhere } from '@/lib/query-builder'

export async function GET(req: NextRequest) {
  const db = getDb()
  const p = req.nextUrl.searchParams

  const selectedIds = p.get('ids')?.split(',').filter(Boolean) ?? []

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

  let totalCount: number
  let prevExportedCount: number
  let earliestExport: string | null = null

  if (selectedIds.length > 0) {
    const rows = await query<{ total: string; prev_exported: string; earliest: string | null }>(db,
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE last_exported_at IS NOT NULL) AS prev_exported,
              MIN(last_exported_at)::text AS earliest
       FROM contacts WHERE id = ANY($1::uuid[])`,
      [selectedIds]
    )
    totalCount = parseInt(rows[0].total)
    prevExportedCount = parseInt(rows[0].prev_exported)
    earliestExport = rows[0].earliest
  } else {
    const { where, args } = buildContactsWhere(filters)
    const rows = await query<{ total: string; prev_exported: string; earliest: string | null }>(db,
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE last_exported_at IS NOT NULL) AS prev_exported,
              MIN(last_exported_at)::text AS earliest
       FROM contacts ${where}`,
      args
    )
    totalCount = parseInt(rows[0].total)
    prevExportedCount = parseInt(rows[0].prev_exported)
    earliestExport = rows[0].earliest
  }

  return NextResponse.json({ total: totalCount, prevExportedCount, earliestExport })
}