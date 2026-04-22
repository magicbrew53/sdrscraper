import { NextRequest, NextResponse } from 'next/server'
import { getDb, query } from '@/lib/db'
import { buildContactsWhere } from '@/lib/query-builder'

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
    hide_duplicates: p.get('hide_duplicates') !== 'false',
    exported: p.get('exported'),
    min_confidence: p.get('min_confidence') ? Number(p.get('min_confidence')) : null,
  }
  const { where, args } = buildContactsWhere(filters)
  const rows = await query<{ id: string }>(db,
    `SELECT id FROM contacts ${where} ORDER BY call_priority DESC NULLS LAST`,
    args
  )
  return NextResponse.json({ ids: rows.map(r => r.id) })
}
