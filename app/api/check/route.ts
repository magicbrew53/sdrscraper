import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from '@/lib/classify'

const client = new Anthropic()

export interface CheckLeadInput {
  first_name?: string
  last_name?: string
  title?: string
  company_name: string
  website?: string
  industry?: string
  keywords?: string
  seniority?: string
  departments?: string
  employee_count?: string
}

export async function POST(req: NextRequest) {
  try {
    const lead: CheckLeadInput = await req.json()

    if (!lead.company_name?.trim()) {
      return NextResponse.json({ error: 'company_name is required' }, { status: 400 })
    }

    function extractDomain(url: string | undefined): string {
      if (!url) return ''
      try {
        const u = new URL(url.startsWith('http') ? url : `https://${url}`)
        return u.hostname.replace('www.', '')
      } catch {
        return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] ?? ''
      }
    }

    const payload = [{
      index: 0,
      company: lead.company_name,
      industry: lead.industry ?? '',
      keywords: (lead.keywords ?? '').slice(0, 300),
      website: extractDomain(lead.website),
      title: lead.title ?? '',
    }]

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Classify these contacts:\n\n${JSON.stringify(payload, null, 2)}` }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const results = JSON.parse(text)
    const result = results[0]

    return NextResponse.json({
      status: result.status,
      niche: result.niche,
      confidence: result.confidence,
      reason: result.reason,
    })
  } catch (err) {
    console.error('[check] classify error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}