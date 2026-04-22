import { NextRequest, NextResponse } from 'next/server'
import { getDb, query } from '@/lib/db'

interface VerificationJob {
  id: string
  total: number
  completed: number
  current_step: string
  website_complete: number
  company_complete: number
  person_complete: number
  dm_complete: number
  status: string
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const { job_id } = await params
  const db = getDb()
  const rows = await query<VerificationJob>(db,
    `SELECT id, total, completed, current_step,
            website_complete, company_complete, person_complete, dm_complete, status
     FROM verification_jobs WHERE id = $1`,
    [job_id]
  )

  if (!rows.length) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json(rows[0])
}