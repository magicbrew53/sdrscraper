import { NextResponse } from 'next/server'
import { getDb, query } from '@/lib/db'

export async function GET() {
  const checks: Record<string, string> = {}

  checks.DATABASE_URL = process.env.DATABASE_URL ? 'set' : 'MISSING'
  checks.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ? 'set' : 'MISSING'
  checks.SERPER_API_KEY = process.env.SERPER_API_KEY ? 'set' : 'MISSING (needed for verification)'

  try {
    const db = getDb()
    await query(db, 'SELECT 1')
    checks.db_connect = 'ok'
  } catch (err) {
    checks.db_connect = `FAILED: ${err instanceof Error ? err.message : String(err)}`
    return NextResponse.json(checks, { status: 500 })
  }

  try {
    const db = getDb()
    const tables = await query<{ tablename: string }>(db,
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('uploads','contacts','verification_jobs')`
    )
    const found = tables.map(r => r.tablename).sort().join(', ')
    const expected = 'contacts, uploads, verification_jobs'
    checks.tables = found === expected ? `ok (${found})` : `MISSING some — found: "${found}"`

    // Check v2 columns exist
    const cols = await query<{ column_name: string }>(db,
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'verification_status'`
    )
    checks.v2_schema = cols.length > 0 ? 'ok' : 'MISSING — run lib/schema-v2.sql'
  } catch (err) {
    checks.tables = `FAILED: ${err instanceof Error ? err.message : String(err)}`
  }

  const allOk = Object.values(checks).every(v => v === 'ok' || v === 'set' || v.startsWith('ok'))
  return NextResponse.json(checks, { status: allOk ? 200 : 500 })
}