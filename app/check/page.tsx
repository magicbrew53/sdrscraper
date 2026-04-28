'use client'

import { useState } from 'react'
import type { CheckLeadInput } from '../api/check/route'

interface ClassifyResult {
  status: string
  niche: string
  confidence: number
  reason: string
}

interface VerifyResult {
  website: { alive: boolean; httpStatus: number | null; redirectUrl: string | null } | null
  company: { active: boolean; confidence: number; signals: string[] }
  person: { verified: boolean | null; confidence: number; currentTitle: string | null; source: string | null }
  dm: { score: number; reasoning: string }
  auto_downgrade: boolean
}

const STATUS_COLORS: Record<string, string> = {
  'Fit': 'bg-green-500/20 text-green-300 border border-green-500/40',
  'Maybe': 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
  'Not a Fit': 'bg-red-500/20 text-red-300 border border-red-500/40',
}

function pct(n: number) { return Math.round(n * 100) + '%' }

function VerifyRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-gray-700/50 last:border-0">
      <span className="text-gray-400 text-sm shrink-0">{label}</span>
      <div className="text-right">
        <span className="text-white text-sm">{value}</span>
        {sub && <p className="text-gray-400 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function CheckPage() {
  const [form, setForm] = useState<CheckLeadInput>({
    company_name: '',
    first_name: '',
    last_name: '',
    title: '',
    website: '',
    industry: '',
    keywords: '',
    employee_count: '',
    seniority: '',
    departments: '',
  })
  const [classifying, setClassifying] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<ClassifyResult | null>(null)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof CheckLeadInput, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setResult(null)
    setVerifyResult(null)
    setError(null)
  }

  async function handleClassify(e: React.FormEvent) {
    e.preventDefault()
    setClassifying(true)
    setError(null)
    setResult(null)
    setVerifyResult(null)
    try {
      const res = await fetch('/api/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? res.statusText)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setClassifying(false)
    }
  }

  async function handleVerify() {
    if (!result) return
    setVerifying(true)
    setVerifyResult(null)
    setError(null)
    try {
      const payload = { ...form, mqs_status: result.status, mqs_niche: result.niche, mqs_confidence: result.confidence }
      const res = await fetch('/api/check/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? res.statusText)
      setVerifyResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white">Single Lead Check</h1>
          <p className="text-sm text-gray-400 mt-1">Paste in a lead to classify and optionally verify.</p>
        </div>

        <form onSubmit={handleClassify} className="bg-gray-900 border border-gray-700 rounded-lg p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" value={form.first_name ?? ''} onChange={v => set('first_name', v)} />
            <Field label="Last Name" value={form.last_name ?? ''} onChange={v => set('last_name', v)} />
          </div>
          <Field label="Title" value={form.title ?? ''} onChange={v => set('title', v)} />
          <Field label="Company Name *" value={form.company_name} onChange={v => set('company_name', v)} required />
          <Field label="Website" value={form.website ?? ''} onChange={v => set('website', v)} placeholder="example.com" />
          <Field label="Industry" value={form.industry ?? ''} onChange={v => set('industry', v)} />
          <Field label="Keywords" value={form.keywords ?? ''} onChange={v => set('keywords', v)} placeholder="e.g. outsourced sales, BDR, appointment setting" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Employees" value={form.employee_count ?? ''} onChange={v => set('employee_count', v)} placeholder="e.g. 50" />
            <Field label="Seniority" value={form.seniority ?? ''} onChange={v => set('seniority', v)} placeholder="e.g. director" />
          </div>
          <Field label="Department" value={form.departments ?? ''} onChange={v => set('departments', v)} />

          <button
            type="submit"
            disabled={classifying || !form.company_name.trim()}
            className="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm py-2.5 rounded transition-colors font-medium"
          >
            {classifying ? 'Classifying…' : 'Check Fit'}
          </button>
        </form>

        {error && (
          <div className="mt-4 bg-red-900/30 border border-red-500/40 rounded-lg p-4 text-red-300 text-sm">{error}</div>
        )}

        {result && (
          <div className="mt-4 bg-gray-900 border border-gray-700 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[result.status] ?? 'bg-gray-700 text-gray-300'}`}>
                {result.status}
              </span>
              <span className="text-gray-400 text-sm">{pct(result.confidence)} confidence</span>
            </div>

            {result.niche !== 'None' && (
              <p className="text-blue-300 text-sm font-medium">{result.niche}</p>
            )}

            <p className="text-gray-300 text-sm">{result.reason}</p>

            {!verifyResult && (
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 text-sm py-2 rounded transition-colors"
              >
                {verifying ? 'Verifying…' : 'Verify'}
              </button>
            )}
          </div>
        )}

        {verifying && (
          <div className="mt-4 bg-gray-900 border border-gray-700 rounded-lg p-5 text-center text-gray-400 text-sm">
            Running checks… (website → company → person → DM score)
          </div>
        )}

        {verifyResult && (
          <div className="mt-4 bg-gray-900 border border-gray-700 rounded-lg p-5 space-y-1">
            <h2 className="text-white font-medium text-sm mb-3">Verification Results</h2>

            {verifyResult.auto_downgrade && (
              <div className="mb-3 bg-red-900/30 border border-red-500/40 rounded px-3 py-2 text-red-300 text-xs">
                Would auto-downgrade to Not a Fit
              </div>
            )}

            {verifyResult.website !== null && (
              <VerifyRow
                label="Website"
                value={verifyResult.website.alive ? `Live (${verifyResult.website.httpStatus})` : `Dead (${verifyResult.website.httpStatus ?? 'timeout'})`}
                sub={verifyResult.website.redirectUrl ?? undefined}
              />
            )}

            <VerifyRow
              label="Company active"
              value={`${verifyResult.company.active ? 'Yes' : 'No'} · ${pct(verifyResult.company.confidence)}`}
              sub={verifyResult.company.signals.join(' · ')}
            />

            <VerifyRow
              label="Person at company"
              value={
                verifyResult.person.verified === null ? 'Unknown'
                : verifyResult.person.verified ? `Confirmed · ${pct(verifyResult.person.confidence)}`
                : `Not confirmed · ${pct(verifyResult.person.confidence)}`
              }
              sub={[verifyResult.person.currentTitle, verifyResult.person.source].filter(Boolean).join(' · ') || undefined}
            />

            <VerifyRow
              label="DM score"
              value={pct(verifyResult.dm.score)}
              sub={verifyResult.dm.reasoning}
            />
          </div>
        )}

        <div className="mt-6 text-center">
          <a href="/results" className="text-sm text-gray-500 hover:text-gray-400">← Back to results</a>
        </div>
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, required, placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
      />
    </div>
  )
}