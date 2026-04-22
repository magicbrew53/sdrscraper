import { NextRequest, NextResponse } from 'next/server'
import { getDb, query, pgUuidArray } from '@/lib/db'

export async function DELETE(req: NextRequest) {
  const { ids } = await req.json() as { ids: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No ids provided' }, { status: 400 })
  }
  const db = getDb()
  await query(db,
    `DELETE FROM contacts WHERE id = ANY($1::uuid[])`,
    [pgUuidArray(ids)]
  )
  return NextResponse.json({ ok: true, deleted: ids.length })
}
