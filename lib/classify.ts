import Anthropic from '@anthropic-ai/sdk'
import { getDb, query } from './db'
import { ClassificationResult } from './types'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a lead classification engine for myQuest Skills (MQS), an AI-powered conversational skill practice and skill mapping platform.

YOUR TASK: For each contact, determine whether their company operates in an MQS target niche. Classify based on the COMPANY — not the individual's title. A VP of Sales at a behavioral health training company is a Fit because the COMPANY is in-niche, not because the person is in sales.

TARGET NICHES (in priority order):

1. SDR OUTSOURCING — Companies that provide outsourced SDR/BDR teams, appointment setting services, outbound calling teams, telemarketing operations, or sales development as a service. This includes BPO companies with sales/calling operations and nearshore/offshore SDR staffing firms. DOES NOT INCLUDE: marketing agencies that list "lead generation" as one of many services, software companies that sell sales tools, or companies that only do inbound marketing.

2. BEHAVIORAL HEALTH / MOTIVATIONAL INTERVIEWING — Substance abuse treatment centers, mental health counseling organizations, CCBHCs, addiction treatment programs, behavioral health training providers, MI training organizations, and companies serving the behavioral health workforce. DOES NOT INCLUDE: general healthcare companies, EHR vendors, or health tech companies without a behavioral health focus.

3. VETERINARY MEDICINE — Veterinary clinics, animal hospitals, veterinary groups/consolidators, veterinary communication training providers, and companies specifically serving the veterinary profession. DOES NOT INCLUDE: pet product companies, veterinary marketing agencies (unless they also provide training), or general animal services.

4. HOSPICE / SERIOUS ILLNESS COMMUNICATION — Hospice agencies, palliative care organizations, advance care planning providers, end-of-life care training, serious illness conversation training, and bereavement services. DOES NOT INCLUDE: general home health companies, senior living facilities (unless hospice-focused), or general healthcare.

5. CHILD WELFARE — Child protective services agencies, foster care organizations, family services departments, forensic interview training providers, child advocacy centers, and organizations serving the child welfare workforce. DOES NOT INCLUDE: general nonprofits serving children, education companies, or daycare providers.

6. FINANCIAL ADVISORY — Wealth management firms, financial planning companies, RIAs, broker-dealers, financial advisor training companies, and organizations focused on advisor-client communication. DOES NOT INCLUDE: banks, insurance companies, fintech platforms, or general financial services companies that merely mention "financial planning" in their keywords.

7. NURSE TELEPHONE TRIAGE — Medical call centers, nurse triage service providers, telehealth nursing companies, triage training organizations, and companies providing outsourced nurse triage. DOES NOT INCLUDE: general telehealth companies, EHR vendors, or health IT companies.

8. TRAINING COMPANIES (CHANNEL PARTNERS) — Companies whose primary business is delivering training, coaching, professional development, or L&D services to OTHER organizations. These are potential channel partners who would purchase MQS to deliver to their own clients. DOES NOT INCLUDE: companies that just have an internal training department, SaaS companies with onboarding, or marketing agencies.

CLASSIFICATION OUTPUT:

For each contact, return:
- status: "Fit" | "Maybe" | "Not a Fit"
- niche: The matching niche name, or "None"
- confidence: 0.0 to 1.0
- reason: One sentence explaining the classification

DECISION RULES:
- "Fit" = The company clearly operates in a target niche based on industry + keywords + company name + website domain.
- "Maybe" = The company is adjacent to a niche or signals are ambiguous. Examples: a marketing agency specializing in veterinary clients, a consulting firm with healthcare focus, a BPO that might have SDR operations.
- "Not a Fit" = The company does not align with any target niche.
- When in doubt between Fit and Maybe, choose Maybe.
- When in doubt between Maybe and Not a Fit, choose Not a Fit. We want the Fit list to be high-signal.
- A company can only match ONE niche — pick the strongest match.
- "lead generation" as a keyword alone does NOT make a company an SDR Outsourcing fit. Most marketing agencies list lead generation. Look for appointment setting, outbound calling, telemarketing, BPO, outsourced SDR, sales development as a service.
- "financial planning" or "estate planning" as a keyword alone does NOT make a company a Financial Advisory fit. Look for wealth management, RIA, financial advisor, fiduciary as PRIMARY business descriptors.

RESPONSE FORMAT:
Return ONLY a JSON array. No markdown, no preamble, no explanation outside the JSON.

[
  {
    "index": 0,
    "status": "Fit",
    "niche": "SDR Outsourcing",
    "confidence": 0.92,
    "reason": "BPO company providing outsourced sales teams and appointment setting services."
  },
  ...
]`

interface ContactForClassification {
  id: string
  company_name: string | null
  industry: string | null
  keywords: string | null
  website: string | null
  title: string | null
}

function extractDomain(url: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace('www.', '')
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || null
  }
}

async function classifyBatch(
  contacts: ContactForClassification[],
  attempt = 0
): Promise<ClassificationResult[]> {
  const payload = contacts.map((c, i) => ({
    index: i,
    company: c.company_name || '',
    industry: c.industry || '',
    keywords: (c.keywords || '').slice(0, 300),
    website: extractDomain(c.website) || '',
    title: c.title || '',
  }))

  const userMessage = `Classify these contacts:\n\n${JSON.stringify(payload, null, 2)}`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const results: ClassificationResult[] = JSON.parse(text)
    return results
  } catch (err) {
    if (attempt < 2) {
      const delay = Math.pow(2, attempt) * 1000
      await new Promise(r => setTimeout(r, delay))
      return classifyBatch(contacts, attempt + 1)
    }
    console.error('[classify] Batch failed after retries:', err)
    return []
  }
}

export async function classifyUpload(uploadId: string): Promise<void> {
  const db = getDb()
  const contacts = await query<ContactForClassification>(
    db,
    `SELECT id, company_name, industry, keywords, website, title
     FROM contacts WHERE upload_id = $1 AND mqs_status = 'pending' ORDER BY created_at`,
    [uploadId]
  )

  const BATCH_SIZE = 10
  const CONCURRENCY = 3
  const batches: ContactForClassification[][] = []

  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    batches.push(contacts.slice(i, i + BATCH_SIZE))
  }

  let processed = 0

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunk = batches.slice(i, i + CONCURRENCY)

    await Promise.all(
      chunk.map(async batch => {
        const results = await classifyBatch(batch)

        for (const result of results) {
          const contact = batch[result.index]
          if (!contact) continue

          await query(db,
            `UPDATE contacts SET mqs_status=$1, mqs_niche=$2, mqs_reason=$3, mqs_confidence=$4 WHERE id=$5`,
            [result.status, result.niche, result.reason, result.confidence, contact.id]
          )
        }

        // Mark any missing contacts as still pending (they'll show up in manual review)
        const returnedIndexes = new Set(results.map(r => r.index))
        for (let idx = 0; idx < batch.length; idx++) {
          if (!returnedIndexes.has(idx)) {
            console.warn(`[classify] Contact at index ${idx} missing from batch response`)
          }
        }

        processed += batch.length

        await query(db,
          `UPDATE uploads SET classified_count = (SELECT COUNT(*) FROM contacts WHERE upload_id=$1 AND mqs_status != 'pending') WHERE id=$1`,
          [uploadId]
        )
      })
    )
  }

  await query(db,
    `UPDATE uploads SET status='complete', completed_at=now() WHERE id=$1`,
    [uploadId]
  )
}