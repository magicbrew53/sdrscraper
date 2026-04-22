'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition, useRef } from 'react'
import { MQS_NICHES } from '@/lib/types'
import type { Upload } from '@/lib/types'

interface Props {
  uploads: Upload[]
  industries: string[]
}

const STATUSES = ['All', 'Fit', 'Maybe', 'Not a Fit']

function buildSummary(p: URLSearchParams): string {
  const parts: string[] = []
  const status = p.get('status')
  const niche = p.get('niche')
  const industry = p.get('industry')
  const verif = p.get('verification_status')
  const conf = p.get('min_confidence')
  const hideDupes = p.get('hide_duplicates') === 'true'
  const exported = p.get('exported')
  const search = p.get('search')
  const upload = p.get('upload_id')

  if (upload) parts.push('selected upload')
  if (status && status !== 'All') parts.push(status)
  else parts.push('all statuses')
  if (niche && niche !== 'All') parts.push(niche)
  if (industry && industry !== 'All') parts.push(industry)
  if (verif && verif !== 'All') parts.push({ verified: 'verified', partial: 'partially verified', failed: 'failed', unverified: 'unverified', pending: 'pending' }[verif] ?? verif)
  if (conf) parts.push(`≥${conf}% confidence`)
  if (exported === 'not_exported') parts.push('not yet exported')
  else if (exported === 'exported') parts.push('previously exported')
  if (hideDupes) parts.push('duplicates hidden')
  if (search) parts.push(`matching "${search}"`)

  return parts.join(' · ')
}

export default function Filters({ uploads, industries }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const get = (key: string) => searchParams.get(key) || ''

  const push = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(updates)) {
        if (v && v !== 'All' && v !== '') params.set(k, v)
        else params.delete(k)
      }
      params.delete('page')
      startTransition(() => router.push(`${pathname}?${params.toString()}`))
    },
    [router, pathname, searchParams]
  )

  const currentStatus = get('status') || 'All'
  const currentNiche = get('niche') || 'All'
  const currentIndustry = get('industry') || 'All'
  const currentSearch = get('search')
  const currentUpload = get('upload_id')
  const currentVerif = get('verification_status') || 'All'
  const currentConf = parseInt(get('min_confidence') || '65')
  const hideDuplicates = searchParams.get('hide_duplicates') !== 'false'
  const currentExported = get('exported') || 'All'

  const summary = buildSummary(searchParams)

  return (
    <div className="space-y-3">
      {/* Row 1: Upload selector + search */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={currentUpload}
          onChange={e => push({ upload_id: e.target.value })}
          className="bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded px-3 py-2 min-w-[240px]"
        >
          <option value="">All uploads</option>
          {uploads.map(u => (
            <option key={u.id} value={u.id}>
              {u.filename} · {new Date(u.created_at).toLocaleDateString()}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search company, name, keywords..."
          defaultValue={currentSearch}
          onChange={e => {
            if (searchTimer.current) clearTimeout(searchTimer.current)
            const val = e.target.value
            searchTimer.current = setTimeout(() => push({ search: val }), 300)
          }}
          className="bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded px-3 py-2 min-w-[280px]"
        />
      </div>

      {/* Row 2: Status, niche, industry, verification */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-gray-400 text-sm">Status:</span>
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => push({ status: s })}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              currentStatus === s
                ? s === 'Fit' ? 'bg-green-700 text-white'
                  : s === 'Maybe' ? 'bg-yellow-700 text-white'
                  : s === 'Not a Fit' ? 'bg-red-800 text-white'
                  : 'bg-gray-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {s}
          </button>
        ))}

        <span className="text-gray-400 text-sm ml-3">Niche:</span>
        <select
          value={currentNiche}
          onChange={e => push({ niche: e.target.value })}
          className="bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded px-3 py-2"
        >
          <option value="All">All niches</option>
          {MQS_NICHES.map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        <select
          value={currentIndustry}
          onChange={e => push({ industry: e.target.value })}
          className="bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded px-3 py-2"
        >
          <option value="All">All industries</option>
          {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
        </select>

        <span className="text-gray-400 text-sm ml-3">Verified:</span>
        <select
          value={currentVerif}
          onChange={e => push({ verification_status: e.target.value })}
          className="bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded px-3 py-2"
        >
          <option value="All">All</option>
          <option value="unverified">Unverified</option>
          <option value="verified">Verified ✅</option>
          <option value="partial">Partial ⚠️</option>
          <option value="failed">Failed ❌</option>
          <option value="pending">Pending ⏳</option>
        </select>

        <select
          value={currentExported}
          onChange={e => push({ exported: e.target.value })}
          className="bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded px-3 py-2"
        >
          <option value="All">All exports</option>
          <option value="not_exported">Not exported</option>
          <option value="exported">Previously exported</option>
        </select>
      </div>

      {/* Row 3: Confidence slider + hide duplicates */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm whitespace-nowrap">Min Confidence:</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={currentConf}
            onChange={e => {
              const val = e.target.value
              push({ min_confidence: val === '0' ? '' : val })
            }}
            className="w-28 accent-blue-500"
          />
          <span className="text-gray-300 text-sm w-10">{currentConf}%</span>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <div
            onClick={() => push({ hide_duplicates: hideDuplicates ? 'false' : 'true' })}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              hideDuplicates ? 'bg-blue-600' : 'bg-gray-600'
            }`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
              hideDuplicates ? 'translate-x-4' : 'translate-x-1'
            }`} />
          </div>
          <span className="text-gray-300 text-sm">Hide duplicates</span>
        </label>
      </div>

      {/* Filter summary */}
      {summary && (
        <p className="text-xs text-gray-500 italic">{summary}</p>
      )}
    </div>
  )
}