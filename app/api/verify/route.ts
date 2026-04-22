import { NextRequest, NextResponse, after } from 'next/server'
import { getDb, query, pgUuidArray } from '@/lib/db'
import { getEligibleContactIds, runVerification, type VerifyFilters } from '@/lib/verify'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as VerifyFilters

    const contactIds = await getEligibleContactIds(body)

    if (contactIds.length === 0) {
      return NextResponse.json({ error: 'No eligible contacts found' }, { status: 400 })
    }

    const db = getDb()
    const [job] = await query<{ id: string }>(db,
      `INSERT INTO verification_jobs (upload_id, filters, total, status)
       VALUES ($1, $2, $3, 'running') RETURNING id`,
      [body.upload_id ?? null, JSON.stringify(body), contactIds.length]
    )

    // Fire-and-forget
    after(async () => {
      try {
        await runVerification(job.id, contactIds)
      } catch (err) {
        console.error('[verify] Error:', err)
        query(db,
          `UPDATE verification_jobs SET status = 'failed' WHERE id = $1`,
          [job.id]
        ).catch(() => {})
      }
    })

    return NextResponse.json({ jobId: job.id, eligibleCount: contactIds.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[verify] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// GET: count eligible contacts for the button label
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const filters: VerifyFilters = {
      upload_id: params.get('upload_id') ?? undefined,
      status: params.get('status') ?? undefined,
      niche: params.get('niche') ?? undefined,
      industry: params.get('industry') ?? undefined,
      search: params.get('search') ?? undefined,
    }
    const explicitIds = params.get('ids')?.split(',').filter(Boolean)
    let ids: string[]
    if (explicitIds && explicitIds.length > 0) {
      ids = await getEligibleContactIds({ ...filters, ids: explicitIds })
    } else {
      ids = await getEligibleContactIds(filters)
    }

    // Count how many are already verified
    const db = getDb()
    let alreadyVerifiedCount = 0
    if (ids.length > 0) {
      const rows = await query<{ cnt: string }>(db,
        `SELECT COUNT(*) AS cnt FROM contacts
         WHERE id = ANY($1::uuid[]) AND verification_status NOT IN ('unverified', 'pending') AND verification_status IS NOT NULL`,
        [pgUuidArray(ids)]
      )
      alreadyVerifiedCount = parseInt(rows[0]?.cnt ?? '0')
    }

    return NextResponse.json({ eligibleCount: ids.length, alreadyVerifiedCount })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}