import { NextRequest, NextResponse } from 'next/server'
import { getDb, query } from '@/lib/db'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()

  // Restore pre-verification status and clear auto-downgrade flags
  await query(db,
    `UPDATE contacts SET
      mqs_status = COALESCE(pre_verification_status, mqs_status),
      mqs_niche = COALESCE(pre_verification_niche, mqs_niche),
      auto_downgraded = false,
      auto_downgrade_reason = null,
      pre_verification_status = null,
      pre_verification_niche = null,
      verification_status = 'partial'
     WHERE id = $1 AND auto_downgraded = true`,
    [id]
  )

  // Return updated contact fields
  const rows = await query<{
    mqs_status: string
    mqs_niche: string | null
    auto_downgraded: boolean
    verification_status: string
  }>(db,
    `SELECT mqs_status, mqs_niche, auto_downgraded, verification_status FROM contacts WHERE id = $1`,
    [id]
  )

  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(rows[0])
}