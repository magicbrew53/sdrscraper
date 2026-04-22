import { NextResponse } from 'next/server'
import { getDb, query } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const uploads = await query<{
    id: string; filename: string; total_contacts: number
    classified_count: number; status: string; created_at: string
    fit_count: number; maybe_count: number; not_a_fit_count: number
  }>(db,
    `SELECT u.id, u.filename, u.total_contacts, u.classified_count, u.status, u.created_at,
       COUNT(*) FILTER (WHERE COALESCE(c.override_status, c.mqs_status) = 'Fit') AS fit_count,
       COUNT(*) FILTER (WHERE COALESCE(c.override_status, c.mqs_status) = 'Maybe') AS maybe_count,
       COUNT(*) FILTER (WHERE COALESCE(c.override_status, c.mqs_status) = 'Not a Fit') AS not_a_fit_count
     FROM uploads u
     LEFT JOIN contacts c ON c.upload_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at DESC
     LIMIT 50`
  )
  return NextResponse.json(uploads)
}