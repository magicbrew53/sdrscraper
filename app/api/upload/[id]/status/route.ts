import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const [upload] = await sql`
    SELECT id, status, total_contacts, classified_count
    FROM uploads WHERE id = ${id}
  `

  if (!upload) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
  }

  return NextResponse.json(upload)
}