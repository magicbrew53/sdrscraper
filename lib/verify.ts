import Anthropic from '@anthropic-ai/sdk'
import { getDb, query, sql } from './db'
import { serperSearch, formatResultsForPrompt } from './serper'

const anthropic = new Anthropic()

// ─── Types ────────────────────────────────────────────────────────────────────

interface EligibleContact {
  id: string
  first_name: string | null
  last_name: string | null
  title: string | null
  company_name: string | null
  website: string | null
  industry: string | null
  employee_count: string | null
  seniority: string | null
  departments: string | null
  mqs_status: string
  mqs_niche: string | null
  mqs_confidence: number | null
  override_status: string | null
  override_niche: string | null
}

interface WebsiteCheckResult {
  alive: boolean
  httpStatus: number | null
  redirectUrl: string | null
}

interface CompanyCheckResult {
  active: boolean
  confidence: number
  signals: string[]
}

interface PersonCheckResult {
  verified: boolean | null  // null = unknown
  confidence: number
  currentTitle: string | null
  source: string | null
}

interface DMCheckResult {
  score: number
  reasoning: string
}

// ─── Check 1: Website alive ───────────────────────────────────────────────────

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

async function checkWebsite(url: string): Promise<WebsiteCheckResult> {
  const normalised = url.startsWith('http') ? url : `https://${url}`

  const doRequest = async (method: 'HEAD' | 'GET'): Promise<WebsiteCheckResult> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    try {
      const res = await fetch(normalised, {
        method,
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': CHROME_UA },
      })
      clearTimeout(timer)
      const alive = [200, 301, 302, 307, 308].includes(res.status) || (res.status >= 200 && res.status < 400)
      return { alive, httpStatus: res.status, redirectUrl: res.url !== normalised ? res.url : null }
    } catch {
      clearTimeout(timer)
      return { alive: false, httpStatus: null, redirectUrl: null }
    }
  }

  const result = await doRequest('HEAD')
  // 405 = HEAD not allowed — retry with GET
  if (result.httpStatus === 405) return doRequest('GET')
  return result
}

// ─── Check 2: Company active ──────────────────────────────────────────────────

async function checkCompanyActive(
  contact: EligibleContact,
  websiteAlive: boolean | null
): Promise<CompanyCheckResult> {
  const results = await serperSearch(`"${contact.company_name}"`, 5)
  const formatted = formatResultsForPrompt(results)

  const websiteStatus =
    websiteAlive === true ? 'alive' : websiteAlive === false ? 'dead' : 'unknown'

  const prompt = `You are verifying whether a company is still actively in business.

Company: ${contact.company_name}
Website: ${contact.website || 'unknown'}
Website status: ${websiteStatus}

Google search results for this company:
${formatted}

Based on these signals, determine:
1. Is this company still actively operating? (true/false)
2. Confidence (0.0 to 1.0)
3. Key signals that informed your decision (list the 2-3 most important)

If the website is dead AND there are no recent search results, confidence should be high that the company is not active.
If the website is alive but search results mention acquisition or closure, flag as potentially inactive with moderate confidence.
If there are recent job postings, news, or social activity, the company is almost certainly active.

Return ONLY JSON:
{"active": true, "confidence": 0.85, "signals": ["Recent job posting on Indeed (March 2026)", "Active LinkedIn page with 43 employees"]}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const parsed = JSON.parse(text) as { active: boolean; confidence: number; signals: string[] }
    return { active: parsed.active, confidence: parsed.confidence, signals: parsed.signals ?? [] }
  } catch {
    // No results or parse failure — treat as unknown (active=true, low confidence)
    return { active: true, confidence: 0.3, signals: ['No search results found'] }
  }
}

// ─── Check 3: Person still at company ────────────────────────────────────────

async function checkPerson(contact: EligibleContact): Promise<PersonCheckResult> {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ')
  const results = await serperSearch(`"${name}" "${contact.company_name}"`, 5)
  const formatted = formatResultsForPrompt(results)

  const prompt = `You are verifying whether a person currently works at a specific company and holds a specific title.

Person: ${name}
Expected company: ${contact.company_name}
Expected title: ${contact.title || 'unknown'} (from Apollo.io data, may be outdated)

Google search results:
${formatted}

Determine:
1. Does this person currently appear to work at ${contact.company_name}? (true/false/unknown)
2. Confidence (0.0 to 1.0)
3. If you found a different current title, what is it?
4. Source of your best evidence (e.g., "LinkedIn snippet", "company website", "press release")

Rules:
- LinkedIn snippets are the strongest signal. If LinkedIn shows them at a different company, they've likely moved.
- If LinkedIn shows the same company but a different title, they're still there but the title is stale — return true with the updated title.
- If you find NO results connecting this person to this company, return "unknown" not "false" — absence of evidence is not evidence of absence.
- Press releases older than 18 months are weak signals.

Return ONLY JSON:
{"verified": true, "confidence": 0.88, "current_title": null, "source": "LinkedIn snippet showing current role at company"}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const parsed = JSON.parse(text) as {
      verified: boolean | 'unknown'
      confidence: number
      current_title: string | null
      source: string | null
    }
    const verified = parsed.verified === 'unknown' ? null : parsed.verified
    return {
      verified,
      confidence: parsed.confidence ?? 0,
      currentTitle: parsed.current_title ?? null,
      source: parsed.source ?? null,
    }
  } catch {
    return { verified: null, confidence: 0, currentTitle: null, source: null }
  }
}

// ─── Check 4: DM scoring ──────────────────────────────────────────────────────

async function checkDMScore(contact: EligibleContact): Promise<DMCheckResult> {
  const effectiveNiche = contact.override_niche || contact.mqs_niche || 'unknown'

  const prompt = `You are scoring whether a person is likely a decision maker or key influencer for purchasing myQuest Skills (MQS) — an AI-powered conversational skill practice platform used for training employees in communication skills.

Person:
- Title: ${contact.title || 'unknown'}
- Seniority: ${contact.seniority || 'unknown'}
- Department: ${contact.departments || 'unknown'}
- Company: ${contact.company_name || 'unknown'}
- Company size: ${contact.employee_count || 'unknown'} employees
- Niche: ${effectiveNiche}

MQS is purchased by people responsible for:
- Training & development / L&D programs
- Workforce development / talent development
- Clinical training (in healthcare niches)
- Sales training / SDR onboarding (in SDR outsourcing niche)
- Operations leadership who own training budgets
- C-suite at small companies (<50 employees) where the CEO/owner makes all purchasing decisions

Score this person 0.0 to 1.0 on likelihood of being a decision maker or key influencer for an MQS purchase:

- 0.9-1.0: Direct decision maker (VP/Director of Training, CLO, VP L&D, CEO of small training company)
- 0.7-0.89: Strong influencer (COO, VP Operations, Director of Clinical Services, Head of SDR)
- 0.5-0.69: Moderate influencer (HR Director, Department Manager, Team Lead with training responsibilities)
- 0.3-0.49: Weak influencer (individual contributor, specialist, coordinator)
- 0.0-0.29: Not a decision maker (unrelated role — IT, finance, marketing at large company)

Important: Company size matters. A CEO at a 15-person company is a direct decision maker (0.95). A CEO at a 5,000-person company is not directly purchasing training tools (0.4). Adjust accordingly.

Return ONLY JSON:
{"score": 0.85, "reasoning": "VP of Training at a 40-person SDR outsourcing firm — directly owns training program decisions and likely controls the budget."}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const parsed = JSON.parse(text) as { score: number; reasoning: string }
    return { score: parsed.score ?? 0.5, reasoning: parsed.reasoning ?? '' }
  } catch {
    return { score: 0.5, reasoning: 'Score unavailable' }
  }
}

// ─── Auto-downgrade helper ────────────────────────────────────────────────────

async function autoDowngrade(contactId: string, reason: string, currentStatus: string, currentNiche: string | null) {
  const db = getDb()
  await query(db,
    `UPDATE contacts SET
      pre_verification_status = $1,
      pre_verification_niche = $2,
      auto_downgraded = true,
      auto_downgrade_reason = $3,
      mqs_status = 'Not a Fit',
      verification_status = 'failed'
     WHERE id = $4`,
    [currentStatus, currentNiche, reason, contactId]
  )
}

// ─── Job progress helper ──────────────────────────────────────────────────────

async function updateJobProgress(jobId: string, updates: Record<string, unknown>) {
  const db = getDb()
  const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ')
  const values = Object.values(updates)
  await query(db, `UPDATE verification_jobs SET ${setClauses} WHERE id = $1`, [jobId, ...values])
}

// ─── Main orchestration ───────────────────────────────────────────────────────

export async function runVerification(jobId: string, contactIds: string[]): Promise<void> {
  const db = getDb()

  // Mark all as pending
  await query(db,
    `UPDATE contacts SET verification_status = 'pending', verification_started_at = now()
     WHERE id = ANY($1::uuid[])`,
    [contactIds]
  )

  // Fetch full contact data
  const contacts = await query<EligibleContact>(db,
    `SELECT id, first_name, last_name, title, company_name, website, industry,
            employee_count, seniority, departments, mqs_status, mqs_niche, mqs_confidence,
            override_status, override_niche
     FROM contacts WHERE id = ANY($1::uuid[])`,
    [contactIds]
  )

  const total = contacts.length
  let completed = 0

  // ── Check 1: Website alive ──────────────────────────────────────────────────
  await updateJobProgress(jobId, { current_step: 'website' })

  const websiteResults = new Map<string, WebsiteCheckResult | null>()
  const WEBSITE_CONCURRENCY = 10

  for (let i = 0; i < contacts.length; i += WEBSITE_CONCURRENCY) {
    const chunk = contacts.slice(i, i + WEBSITE_CONCURRENCY)
    await Promise.all(chunk.map(async contact => {
      let result: WebsiteCheckResult | null = null

      if (contact.website) {
        result = await checkWebsite(contact.website)
        await query(db,
          `UPDATE contacts SET
            website_alive = $1, website_http_status = $2, website_redirect_url = $3,
            website_checked_at = now()
           WHERE id = $4`,
          [result.alive, result.httpStatus, result.redirectUrl, contact.id]
        )

        if (!result.alive) {
          const effectiveStatus = contact.override_status || contact.mqs_status
          const effectiveNiche = contact.override_niche || contact.mqs_niche
          await autoDowngrade(
            contact.id,
            `Company website is dead or unreachable (HTTP ${result.httpStatus ?? 'timeout'})`,
            effectiveStatus,
            effectiveNiche
          )
        }
      }

      websiteResults.set(contact.id, result)
    }))

    const websiteComplete = Math.min(i + WEBSITE_CONCURRENCY, contacts.length)
    await updateJobProgress(jobId, { website_complete: websiteComplete })
  }

  // ── Determine which contacts proceed past Check 1 ──────────────────────────
  // Pass: website alive OR no website (null result = skip = pass)
  const passedWebsite = contacts.filter(c => {
    const r = websiteResults.get(c.id)
    return r === null || r === undefined || r.alive
  })

  // ── Check 2: Company active + Check 3: Person + Check 4: DM ───────────────
  // Checks 3 & 4 run in parallel with each other after Check 2 passes
  await updateJobProgress(jobId, { current_step: 'company' })

  const COMPANY_CONCURRENCY = 3

  for (let i = 0; i < passedWebsite.length; i += COMPANY_CONCURRENCY) {
    const chunk = passedWebsite.slice(i, i + COMPANY_CONCURRENCY)
    await Promise.all(chunk.map(async contact => {
      const websiteAlive = websiteResults.get(contact.id)?.alive ?? null

      // Check 2
      const companyResult = await checkCompanyActive(contact, websiteAlive)
      await query(db,
        `UPDATE contacts SET
          company_active = $1, company_active_confidence = $2, company_active_signals = $3,
          company_checked_at = now()
         WHERE id = $4`,
        [
          companyResult.active,
          companyResult.confidence,
          JSON.stringify(companyResult.signals),
          contact.id,
        ]
      )

      if (!companyResult.active && companyResult.confidence >= 0.75) {
        const effectiveStatus = contact.override_status || contact.mqs_status
        const effectiveNiche = contact.override_niche || contact.mqs_niche
        await autoDowngrade(
          contact.id,
          `Company appears to be no longer in business: ${companyResult.signals[0] ?? 'no signals found'}`,
          effectiveStatus,
          effectiveNiche
        )
        completed++
        await updateJobProgress(jobId, {
          company_complete: i + chunk.indexOf(contact) + 1,
          completed,
        })
        return
      }

      // Checks 3 & 4 in parallel
      const [personResult, dmResult] = await Promise.all([
        checkPerson(contact),
        checkDMScore(contact),
      ])

      await query(db,
        `UPDATE contacts SET
          person_verified = $1, person_verified_confidence = $2,
          person_current_title = $3, person_verified_source = $4,
          person_checked_at = now()
         WHERE id = $5`,
        [
          personResult.verified,
          personResult.confidence,
          personResult.currentTitle,
          personResult.source,
          contact.id,
        ]
      )

      await query(db,
        `UPDATE contacts SET dm_score = $1, dm_reasoning = $2, dm_checked_at = now()
         WHERE id = $3`,
        [dmResult.score, dmResult.reasoning, contact.id]
      )

      // Determine final verification_status
      const hasAllChecks =
        companyResult.confidence > 0 &&
        personResult.confidence > 0 &&
        dmResult.score > 0
      const finalStatus = hasAllChecks ? 'verified' : 'partial'

      await query(db,
        `UPDATE contacts SET
          verification_status = $1, verification_completed_at = now()
         WHERE id = $2 AND verification_status != 'failed'`,
        [finalStatus, contact.id]
      )

      completed++
    }))

    const companyComplete = Math.min(i + COMPANY_CONCURRENCY, passedWebsite.length)
    await updateJobProgress(jobId, {
      company_complete: companyComplete,
      person_complete: companyComplete,
      dm_complete: companyComplete,
      completed,
    })
  }

  // Mark auto-downgraded contacts that didn't reach checks 3/4 as completed
  const autoDowngradedCount = contacts.length - passedWebsite.length
  completed += autoDowngradedCount

  await query(db,
    `UPDATE verification_jobs SET
      status = 'complete', completed = $1, completed_at = now(),
      current_step = 'done'
     WHERE id = $2`,
    [total, jobId]
  )
}

// ─── Build eligible contact ID list from filters ──────────────────────────────

export interface VerifyFilters {
  upload_id?: string
  status?: string
  niche?: string
  industry?: string
  search?: string
  ids?: string[]
  new_only?: string
}

export async function getEligibleContactIds(filters: VerifyFilters): Promise<string[]> {
  const db = getDb()
  const conditions: string[] = [
    `COALESCE(override_status, mqs_status) IN ('Fit', 'Maybe')`,
    `mqs_confidence >= 0.65`,
  ]
  const hasExplicitIds = filters.ids && filters.ids.length > 0
  if (!hasExplicitIds && (!filters.new_only || filters.new_only !== 'true')) {
    conditions.push(`verification_status = 'unverified'`)
  }
  const args: unknown[] = []
  let idx = 1

  if (filters.ids && filters.ids.length > 0) {
    conditions.push(`id = ANY($${idx++}::uuid[])`)
    args.push(filters.ids)
  } else {
    if (filters.upload_id) { conditions.push(`upload_id = $${idx++}`); args.push(filters.upload_id) }
    if (filters.status && filters.status !== 'All') {
      conditions.push(`COALESCE(override_status, mqs_status) = $${idx++}`)
      args.push(filters.status)
    }
    if (filters.niche && filters.niche !== 'All') {
      conditions.push(`COALESCE(override_niche, mqs_niche) = $${idx++}`)
      args.push(filters.niche)
    }
    if (filters.industry && filters.industry !== 'All') {
      conditions.push(`industry = $${idx++}`)
      args.push(filters.industry)
    }
    if (filters.search) {
      conditions.push(
        `(company_name ILIKE $${idx} OR first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR keywords ILIKE $${idx})`
      )
      args.push(`%${filters.search}%`)
      idx++
    }
  }

  const rows = await query<{ id: string }>(
    db,
    `SELECT id FROM contacts WHERE ${conditions.join(' AND ')} ORDER BY mqs_confidence DESC`,
    args
  )
  return rows.map(r => r.id)
}