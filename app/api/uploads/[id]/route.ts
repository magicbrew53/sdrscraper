import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // CASCADE deletes contacts too (FK constraint)
  await sql`DELETE FROM uploads WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}