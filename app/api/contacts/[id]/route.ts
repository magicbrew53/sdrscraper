import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { override_status, override_niche, override_reason } = body

  await sql`
    UPDATE contacts SET
      override_status = ${override_status ?? null},
      override_niche = ${override_niche ?? null},
      override_reason = ${override_reason ?? null},
      overridden_by = 'rico',
      overridden_at = now()
    WHERE id = ${id}
  `

  return NextResponse.json({ ok: true })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const [contact] = await sql`
    SELECT
      id, keywords, mqs_reason, mqs_confidence, mqs_niche, mqs_status,
      override_status, override_niche, override_reason, overridden_by, overridden_at,
      website, linkedin_url,
      verification_status,
      website_alive, website_http_status, website_redirect_url, website_checked_at,
      company_active, company_active_confidence, company_active_signals, company_checked_at,
      person_verified, person_verified_confidence, person_current_title,
      person_verified_source, person_checked_at,
      dm_score, dm_reasoning, dm_checked_at,
      auto_downgraded, auto_downgrade_reason, pre_verification_status, pre_verification_niche
    FROM contacts WHERE id = ${id}
  `

  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(contact)
}