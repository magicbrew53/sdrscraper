import { NextRequest, NextResponse } from 'next/server'
import { getDb, query, pgUuidArray } from '@/lib/db'
import { buildContactsWhere } from '@/lib/query-builder'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      ids?: string[]
      filters?: {
        upload_id?: string
        status?: string
        niche?: string
        industry?: string
        search?: string
        verification_status?: string
        hide_duplicates?: boolean
        exported?: string
        min_confidence?: number | null
      }
    }

    const db = getDb()

    if (body.ids && body.ids.length > 0) {
      // Explicit ID list — batch in chunks to avoid query size limits
      const BATCH = 500
      let deleted = 0
      for (let i = 0; i < body.ids.length; i += BATCH) {
        const chunk = body.ids.slice(i, i + BATCH)
        const arr = pgUuidArray(chunk)
        await query(db,
          `UPDATE contacts SET duplicate_of_id = NULL, duplicate_upload_filename = NULL, is_duplicate = false
           WHERE duplicate_of_id = ANY($1::uuid[])`, [arr]
        )
        const rows = await query<{ count: string }>(db,
          `DELETE FROM contacts WHERE id = ANY($1::uuid[]) RETURNING id`, [arr]
        )
        deleted += rows.length
      }
      return NextResponse.json({ ok: true, deleted })
    }

    if (body.filters) {
      // Filter-based delete — single atomic operation, no ID passing needed
      const { where, args } = buildContactsWhere(body.filters)
      if (!where) {
        return NextResponse.json({ error: 'Refusing to delete all contacts with no filters' }, { status: 400 })
      }
      // Clear FK refs first
      await query(db,
        `UPDATE contacts SET duplicate_of_id = NULL, duplicate_upload_filename = NULL, is_duplicate = false
         WHERE duplicate_of_id IN (SELECT id FROM contacts ${where})`,
        args
      )
      const rows = await query<{ id: string }>(db,
        `DELETE FROM contacts ${where} RETURNING id`, args
      )
      return NextResponse.json({ ok: true, deleted: rows.length })
    }

    return NextResponse.json({ error: 'Provide ids or filters' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[bulk-delete]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}