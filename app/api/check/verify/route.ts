import { NextRequest, NextResponse } from 'next/server'
import { checkWebsite, checkCompanyActive, checkPerson, checkDMScore, EligibleContact } from '@/lib/verify'
import type { CheckLeadInput } from '../route'

export async function POST(req: NextRequest) {
  try {
    const body: CheckLeadInput & { mqs_status?: string; mqs_niche?: string; mqs_confidence?: number } = await req.json()

    if (!body.company_name?.trim()) {
      return NextResponse.json({ error: 'company_name is required' }, { status: 400 })
    }

    const contact: EligibleContact = {
      id: 'adhoc',
      first_name: body.first_name ?? null,
      last_name: body.last_name ?? null,
      title: body.title ?? null,
      company_name: body.company_name,
      website: body.website ?? null,
      industry: body.industry ?? null,
      employee_count: body.employee_count ?? null,
      seniority: body.seniority ?? null,
      departments: body.departments ?? null,
      mqs_status: body.mqs_status ?? 'Fit',
      mqs_niche: body.mqs_niche ?? null,
      mqs_confidence: body.mqs_confidence ?? null,
      override_status: null,
      override_niche: null,
    }

    // Step 1: website
    const websiteResult = body.website
      ? await checkWebsite(body.website)
      : null

    // Steps 2-4 in parallel (skip company/person/DM if site is dead)
    const siteAlive = websiteResult?.alive ?? true

    const [companyResult, personResult, dmResult] = await Promise.all([
      checkCompanyActive(contact, websiteResult?.alive ?? null),
      checkPerson(contact),
      checkDMScore(contact),
    ])

    return NextResponse.json({
      website: websiteResult,
      company: companyResult,
      person: personResult,
      dm: dmResult,
      auto_downgrade: !siteAlive || (!companyResult.active && companyResult.confidence >= 0.75),
    })
  } catch (err) {
    console.error('[check/verify] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}