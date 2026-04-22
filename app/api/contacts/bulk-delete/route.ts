import { NextRequest, NextResponse } from 'next/server'
import { getDb, query, pgUuidArray } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json() as { ids: string[] }
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No ids provided' }, { status: 400 })
    }
    const db = getDb()
    const BATCH = 500
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH)
      const arr = pgUuidArray(chunk)
      await query(db,
        `UPDATE contacts SET duplicate_of_id = NULL, duplicate_upload_filename = NULL, is_duplicate = false
         WHERE duplicate_of_id = ANY($1::uuid[])`,
        [arr]
      )
      await query(db,
        `DELETE FROM contacts WHERE id = ANY($1::uuid[])`,
        [arr]
      )
    }
    return NextResponse.json({ ok: true, deleted: ids.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[bulk-delete]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
