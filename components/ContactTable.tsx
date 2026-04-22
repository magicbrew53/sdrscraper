'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Contact } from '@/lib/types'
import OverrideForm from './OverrideForm'

// ─── Column visibility ────────────────────────────────────────────────────────

const ALL_COLS = [
  'priority', 'status', 'niche', 'name', 'title', 'company',
  'industry', 'email', 'phone', 'linkedin', 'confidence',
  'verif', 'site', 'active', 'person', 'dm', 'last_verified',
] as const
type ColKey = typeof ALL_COLS[number]

const DEFAULT_VISIBLE: ColKey[] = [
  'priority', 'status', 'name', 'title', 'company', 'email', 'phone', 'dm', 'last_verified',
]

const COL_LABELS: Record<ColKey, string> = {
  priority: 'Score', status: 'Status', niche: 'Niche', name: 'Name',
  title: 'Title', company: 'Company', industry: 'Industry', email: 'Email',
  phone: 'Phone', linkedin: 'Li', confidence: 'Conf.', verif: 'Verif.',
  site: 'Site', active: 'Co.', person: 'Person', dm: 'DM', last_verified: 'Last Verified',
}

function useColumnVisibility() {
  const [visible, setVisible] = useState<Set<ColKey>>(() => {
    if (typeof window === 'undefined') return new Set(DEFAULT_VISIBLE)
    try {
      const stored = localStorage.getItem('mqs_cols')
      return stored ? new Set(JSON.parse(stored) as ColKey[]) : new Set(DEFAULT_VISIBLE)
    } catch { return new Set(DEFAULT_VISIBLE) }
  })

  const toggle = useCallback((col: ColKey) => {
    setVisible(prev => {
      const next = new Set(prev)
      if (next.has(col)) next.delete(col)
      else next.add(col)
      localStorage.setItem('mqs_cols', JSON.stringify([...next]))
      return next
    })
  }, [])

  return { visible, toggle }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  'Fit': 'bg-green-800 text-green-200',
  'Maybe': 'bg-yellow-800 text-yellow-200',
  'Not a Fit': 'bg-red-900 text-red-200',
  'pending': 'bg-gray-700 text-gray-400',
}

function getVerifBadge(contact: Contact): string | null {
  if (contact.verification_status === 'unverified') return null
  if (contact.auto_downgraded) return null
  if (contact.verification_status === 'verified') {
    const hasWarning =
      (contact.person_verified === false && (contact.person_verified_confidence ?? 0) >= 0.8) ||
      (contact.dm_score ?? 1) < 0.5
    return hasWarning ? '⚠' : '✓'
  }
  if (contact.verification_status === 'partial') return '⚠'
  return null
}

function getRowBorderStyle(contact: Contact): React.CSSProperties {
  if (contact.auto_downgraded || contact.verification_status === 'failed') {
    return { borderLeft: '3px solid #ef4444' }
  }
  if (contact.verification_status === 'verified') {
    const hasWarning =
      (contact.person_verified === false && (contact.person_verified_confidence ?? 0) >= 0.8) ||
      (contact.dm_score ?? 1) < 0.5
    return { borderLeft: `3px solid ${hasWarning ? '#eab308' : '#22c55e'}` }
  }
  if (contact.verification_status === 'partial') {
    return { borderLeft: '3px solid #eab308' }
  }
  return {}
}

function Truncated({ text, maxLen = 38 }: { text: string | null; maxLen?: number }) {
  if (!text) return <span className="text-gray-600">—</span>
  if (text.length <= maxLen) return <span>{text}</span>
  return <span title={text}>{text.slice(0, maxLen)}…</span>
}

function CopyCell({ value, href }: { value: string | null; href?: string }) {
  const [copied, setCopied] = useState(false)
  if (!value) return <span className="text-gray-600">—</span>

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) return // allow default for cmd/ctrl+click
    e.preventDefault()
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <span className="relative group">
      <a
        href={href || `mailto:${value}`}
        onClick={handleClick}
        className="text-blue-400 hover:text-blue-300 cursor-copy"
        title="Click to copy · Ctrl+click to open"
      >
        <Truncated text={value} maxLen={26} />
      </a>
      {copied && (
        <span className="absolute -top-6 left-0 bg-gray-700 text-gray-100 text-xs px-2 py-0.5 rounded whitespace-nowrap z-10">
          Copied!
        </span>
      )}
    </span>
  )
}

function PriorityBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-gray-600">—</span>
  const n = Math.round(score)
  const color = n >= 70 ? 'text-green-400' : n >= 40 ? 'text-yellow-400' : 'text-red-400'
  return <span className={`text-xs font-bold tabular-nums ${color}`}>{n}</span>
}

function DMScore({ score }: { score: number | null }) {
  if (score == null) return <span className="text-gray-600">—</span>
  const pct = Math.round(score * 100)
  const color = pct >= 70 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'
  return <span className={`text-xs font-medium ${color}`}>{pct}%</span>
}

function VerifIcon({ status }: { status: string | null }) {
  const map: Record<string, string> = { verified: '✅', pending: '⏳', failed: '❌', partial: '⚠️', unverified: '➖' }
  return <span title={status ?? 'unverified'}>{map[status ?? 'unverified'] ?? '➖'}</span>
}

function BoolIcon({ value }: { value: boolean | null }) {
  if (value === null || value === undefined) return <span className="text-gray-600">➖</span>
  return value ? <span className="text-green-400">🟢</span> : <span className="text-red-400">🔴</span>
}

function PersonIcon({ verified }: { verified: boolean | null }) {
  if (verified === null) return <span className="text-yellow-400 text-xs" title="unknown">🟡</span>
  return verified
    ? <span className="text-green-400 text-xs" title="confirmed">🟢</span>
    : <span className="text-red-400 text-xs" title="may have left">🔴</span>
}

function LastVerified({ date }: { date: string | null }) {
  if (!date) return <span className="text-gray-600 text-xs">—</span>
  const d = new Date(date)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  let label: string
  if (diffDays === 0) label = 'Today'
  else if (diffDays === 1) label = 'Yesterday'
  else label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return <span className="text-gray-400 text-xs">{label}</span>
}

interface DetailFull {
  keywords: string | null; mqs_reason: string | null; website: string | null; linkedin_url: string | null
  verification_status: string | null
  website_alive: boolean | null; website_http_status: number | null; website_redirect_url: string | null; website_checked_at: string | null
  company_active: boolean | null; company_active_confidence: number | null; company_active_signals: string | null; company_checked_at: string | null
  person_verified: boolean | null; person_verified_confidence: number | null; person_current_title: string | null; person_verified_source: string | null; person_checked_at: string | null
  dm_score: number | null; dm_reasoning: string | null; dm_checked_at: string | null
  auto_downgraded: boolean | null; auto_downgrade_reason: string | null; pre_verification_status: string | null
  override_reason: string | null; overridden_by: string | null
}

function fmtDate(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function VerificationDetails({ detail, contactId, onUndoDowngrade }: {
  detail: DetailFull
  contactId: string
  onUndoDowngrade: () => void
}) {
  const [undoing, setUndoing] = useState(false)
  const hasAny = detail.website_checked_at || detail.company_checked_at || detail.person_checked_at || detail.dm_checked_at
  if (!hasAny) return null

  const signals: string[] = (() => {
    try { return JSON.parse(detail.company_active_signals ?? '[]') }
    catch { return [] }
  })()

  const handleUndo = async () => {
    setUndoing(true)
    await fetch(`/api/contacts/${contactId}/undo-downgrade`, { method: 'POST' })
    setUndoing(false)
    onUndoDowngrade()
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-700 space-y-1.5 text-sm">
      <p className="text-gray-500 text-xs uppercase tracking-wide">Verification</p>
      {detail.auto_downgraded && (
        <div className="flex items-center gap-3 bg-red-950 border border-red-800 rounded px-3 py-2">
          <div className="flex-1 text-xs">
            <span className="text-red-300">Auto-downgraded: </span>
            <span className="text-red-200">{detail.auto_downgrade_reason}</span>
            {detail.pre_verification_status && <span className="text-red-400 ml-2">(was: {detail.pre_verification_status})</span>}
          </div>
          <button onClick={handleUndo} disabled={undoing}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-2 py-1 rounded whitespace-nowrap disabled:opacity-50">
            {undoing ? 'Undoing...' : 'Undo'}
          </button>
        </div>
      )}
      {detail.website_checked_at && (
        <p className="text-xs">
          <span className="text-gray-500 w-20 inline-block">Website:</span>
          {detail.website_alive
            ? <span className="text-green-400">✅ Alive (HTTP {detail.website_http_status})</span>
            : <span className="text-red-400">❌ Dead (HTTP {detail.website_http_status ?? 'timeout'})</span>}
          {detail.website_redirect_url && <span className="text-gray-400 ml-2">→ {detail.website_redirect_url}</span>}
          <span className="text-gray-600 ml-2">· {fmtDate(detail.website_checked_at)}</span>
        </p>
      )}
      {detail.company_checked_at && (
        <div className="text-xs">
          <p>
            <span className="text-gray-500 w-20 inline-block">Company:</span>
            {detail.company_active
              ? <span className="text-green-400">✅ Active ({Math.round((detail.company_active_confidence ?? 0) * 100)}%)</span>
              : <span className="text-red-400">❌ Inactive ({Math.round((detail.company_active_confidence ?? 0) * 100)}%)</span>}
            <span className="text-gray-600 ml-2">· {fmtDate(detail.company_checked_at)}</span>
          </p>
          {signals.length > 0 && <p className="text-gray-400 ml-20">Signals: {signals.join(', ')}</p>}
        </div>
      )}
      {detail.person_checked_at && (
        <div className="text-xs">
          <p>
            <span className="text-gray-500 w-20 inline-block">Person:</span>
            {detail.person_verified === null
              ? <span className="text-yellow-400">🟡 No results found</span>
              : detail.person_verified
              ? detail.person_current_title
                ? <span className="text-yellow-400">⚠️ Title changed</span>
                : <span className="text-green-400">✅ Confirmed at company</span>
              : <span className="text-yellow-400">⚠️ May have left company</span>}
            <span className="text-gray-600 ml-2">· {fmtDate(detail.person_checked_at)}</span>
          </p>
          {detail.person_current_title && (
            <p className="text-gray-400 ml-20">Found: &quot;{detail.person_current_title}&quot;{detail.person_verified_source && ` (${detail.person_verified_source})`}</p>
          )}
        </div>
      )}
      {detail.dm_score != null && (
        <p className="text-xs">
          <span className="text-gray-500 w-20 inline-block">DM Score:</span>
          <span className={`font-medium ${(detail.dm_score ?? 0) >= 0.7 ? 'text-green-400' : (detail.dm_score ?? 0) >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
            {Math.round((detail.dm_score ?? 0) * 100)}%
          </span>
          {detail.dm_reasoning && <span className="text-gray-400 ml-2">— {detail.dm_reasoning}</span>}
        </p>
      )}
    </div>
  )
}

// ─── Column toggle dropdown ───────────────────────────────────────────────────

function ColumnToggle({ visible, toggle }: { visible: Set<ColKey>; toggle: (c: ColKey) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded">
        Columns ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-600 rounded shadow-xl z-50 p-3 grid grid-cols-2 gap-x-6 gap-y-1 min-w-[220px]">
          {ALL_COLS.map(col => (
            <label key={col} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-white">
              <input type="checkbox" checked={visible.has(col)} onChange={() => toggle(col)} className="accent-purple-500" />
              {COL_LABELS[col]}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Individual row ───────────────────────────────────────────────────────────

function ContactRow({
  contact: initial,
  visible,
  selected,
  onSelect,
  minConfidence,
}: {
  contact: Contact
  visible: Set<ColKey>
  selected: boolean
  onSelect: (id: string, checked: boolean) => void
  minConfidence: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [contact, setContact] = useState(initial)
  const [expanded, setExpanded] = useState(false)
  const [overriding, setOverriding] = useState(false)
  const [detail, setDetail] = useState<DetailFull | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const effectiveStatus = contact.override_status || contact.mqs_status
  const effectiveNiche = contact.override_niche || contact.mqs_niche
  const phone = contact.work_phone || contact.mobile_phone || contact.corporate_phone
  const verifBadge = getVerifBadge(contact)
  const borderStyle = getRowBorderStyle(contact)
  const belowThreshold = (contact.mqs_confidence ?? 1) < minConfidence / 100
  const rowOpacity = belowThreshold ? 'opacity-40' : ''

  const handleExpand = async () => {
    setExpanded(e => !e)
    if (!detail && !loadingDetail) {
      setLoadingDetail(true)
      try {
        const res = await fetch(`/api/contacts/${contact.id}`)
        setDetail(await res.json())
      } finally { setLoadingDetail(false) }
    }
  }

  const handleCompanyClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!contact.company_name) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('search', contact.company_name)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  const show = (col: ColKey) => visible.has(col)

  return (
    <>
      <tr
        className={`border-b border-gray-800 hover:bg-gray-800/40 cursor-pointer ${rowOpacity}`}
        style={borderStyle}
        onClick={handleExpand}
      >
        {/* Checkbox */}
        <td className="px-2 py-2 w-8" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={selected} onChange={e => onSelect(contact.id, e.target.checked)}
            className="accent-purple-500" />
        </td>

        {show('priority') && (
          <td className="px-2 py-2 w-14 text-center"><PriorityBadge score={contact.call_priority} /></td>
        )}
        {show('status') && (
          <td className="px-3 py-2 whitespace-nowrap w-24">
            {contact.auto_downgraded && contact.pre_verification_status ? (
              <div className="space-y-0.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium line-through opacity-50 ${STATUS_COLORS[contact.pre_verification_status] ?? 'bg-gray-700 text-gray-300'}`}>
                  {contact.pre_verification_status}
                </span>
                <br />
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[effectiveStatus] ?? 'bg-gray-700 text-gray-300'}`}>
                  {effectiveStatus}
                </span>
              </div>
            ) : (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[effectiveStatus] ?? 'bg-gray-700 text-gray-300'}`}>
                {effectiveStatus}
                {verifBadge && <span>{verifBadge}</span>}
                {contact.override_status && <span title="Overridden">✎</span>}
              </span>
            )}
          </td>
        )}
        {show('niche') && (
          <td className="px-3 py-2 text-sm text-gray-300 w-36"><Truncated text={effectiveNiche} maxLen={18} /></td>
        )}
        {show('name') && (
          <td className="px-3 py-2 text-sm text-gray-200 w-36 whitespace-nowrap">
            <span>
              {[contact.first_name, contact.last_name].filter(Boolean).join(' ') || '—'}
            </span>
            {contact.is_duplicate && (
              <span
                className="ml-1 text-xs bg-orange-900 text-orange-300 px-1 py-0.5 rounded"
                title={`Also in: ${contact.duplicate_upload_filename ?? 'previous upload'}`}
              >
                Dupe
              </span>
            )}
            {contact.last_exported_at && (
              <span
                className="ml-1 text-gray-500 text-xs"
                title={`Exported ${new Date(contact.last_exported_at).toLocaleDateString()}${contact.export_count && contact.export_count > 1 ? ` (${contact.export_count}×)` : ''}`}
              >
                ↓
              </span>
            )}
          </td>
        )}
        {show('title') && (
          <td className="px-3 py-2 text-sm text-gray-300 w-44"><Truncated text={contact.title} /></td>
        )}
        {show('company') && (
          <td className="px-3 py-2 text-sm text-gray-200 w-44" onClick={e => e.stopPropagation()}>
            <span className="hover:text-white cursor-default"><Truncated text={contact.company_name} /></span>
            {(contact.company_contact_count ?? 0) > 1 && (
              <button
                onClick={handleCompanyClick}
                className="ml-1 text-xs bg-gray-700 hover:bg-gray-500 text-gray-400 hover:text-white px-1 rounded"
                title={`${contact.company_contact_count} contacts from this company — click to filter`}
              >
                {contact.company_contact_count}
              </button>
            )}
          </td>
        )}
        {show('industry') && (
          <td className="px-3 py-2 text-sm text-gray-400 w-36"><Truncated text={contact.industry} /></td>
        )}
        {show('email') && (
          <td className="px-3 py-2 text-sm w-44" onClick={e => e.stopPropagation()}>
            <CopyCell value={contact.email} />
          </td>
        )}
        {show('phone') && (
          <td className="px-3 py-2 text-sm w-32" onClick={e => e.stopPropagation()}>
            <CopyCell value={phone || null} href={phone ? `tel:${phone}` : undefined} />
          </td>
        )}
        {show('linkedin') && (
          <td className="px-2 py-2 text-center w-10" onClick={e => e.stopPropagation()}>
            {contact.linkedin_url
              ? <a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-xs">in</a>
              : <span className="text-gray-600">—</span>}
          </td>
        )}
        {show('confidence') && (
          <td className="px-3 py-2 text-sm text-gray-400 w-16">
            {contact.mqs_confidence != null ? `${Math.round(contact.mqs_confidence * 100)}%` : '—'}
          </td>
        )}
        {show('verif') && (
          <td className="px-2 py-2 text-center w-14"><VerifIcon status={contact.verification_status} /></td>
        )}
        {show('site') && (
          <td className="px-2 py-2 text-center w-10"><BoolIcon value={contact.website_alive} /></td>
        )}
        {show('active') && (
          <td className="px-2 py-2 text-center w-10"><BoolIcon value={contact.company_active} /></td>
        )}
        {show('person') && (
          <td className="px-2 py-2 text-center w-10"><PersonIcon verified={contact.person_verified} /></td>
        )}
        {show('dm') && (
          <td className="px-2 py-2 text-center w-12"><DMScore score={contact.dm_score} /></td>
        )}
        {show('last_verified') && (
          <td className="px-2 py-2 text-center w-20"><LastVerified date={contact.verification_completed_at} /></td>
        )}
        <td className="px-3 py-2 text-sm w-20" onClick={e => e.stopPropagation()}>
          <button onClick={() => setOverriding(o => !o)}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded">
            Override
          </button>
        </td>
      </tr>

      {(expanded || overriding) && (
        <tr className="border-b border-gray-700">
          <td colSpan={ALL_COLS.length + 3} className="px-4 py-3 bg-gray-900">
            {overriding && (
              <OverrideForm
                contactId={contact.id}
                currentStatus={effectiveStatus}
                currentNiche={effectiveNiche}
                onSaved={override => {
                  setContact(c => ({ ...c, override_status: override.override_status, override_niche: override.override_niche, override_reason: override.override_reason }))
                  setOverriding(false)
                }}
                onCancel={() => setOverriding(false)}
              />
            )}
            {expanded && (
              <div className="space-y-1 text-sm text-gray-300">
                {loadingDetail ? <p className="text-gray-500">Loading...</p> : detail ? (
                  <>
                    {detail.mqs_reason && <p><span className="text-gray-500">AI reason:</span> {detail.mqs_reason}</p>}
                    {detail.override_reason && <p><span className="text-gray-500">Override reason:</span> {detail.override_reason}</p>}
                    {detail.keywords && <p><span className="text-gray-500">Keywords:</span> {detail.keywords}</p>}
                    {detail.website && (
                      <p>
                        <span className="text-gray-500">Website:</span>{' '}
                        <a href={detail.website.startsWith('http') ? detail.website : `https://${detail.website}`}
                          target="_blank" rel="noreferrer" className="text-blue-400 hover:underline"
                          onClick={e => e.stopPropagation()}>
                          {detail.website}
                        </a>
                      </p>
                    )}
                    <VerificationDetails
                      detail={detail}
                      contactId={contact.id}
                      onUndoDowngrade={() => {
                        setContact(c => ({ ...c, auto_downgraded: false, verification_status: 'partial', mqs_status: (c.pre_verification_status as Contact['mqs_status']) || c.mqs_status }))
                        setDetail(d => d ? { ...d, auto_downgraded: false } : d)
                      }}
                    />
                  </>
                ) : null}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Main table ───────────────────────────────────────────────────────────────

interface Props {
  contacts: Contact[]
  selectedIds: Set<string>
  onSelectionChange: (ids: Set<string>) => void
  minConfidence: number
}

export default function ContactTable({ contacts, selectedIds, onSelectionChange, minConfidence }: Props) {
  const { visible, toggle } = useColumnVisibility()

  const allOnPageSelected = contacts.length > 0 && contacts.every(c => selectedIds.has(c.id))

  const toggleAll = () => {
    const next = new Set(selectedIds)
    if (allOnPageSelected) contacts.forEach(c => next.delete(c.id))
    else contacts.forEach(c => next.add(c.id))
    onSelectionChange(next)
  }

  const handleSelect = useCallback((id: string, checked: boolean) => {
    const next = new Set(selectedIds)
    if (checked) next.add(id)
    else next.delete(id)
    onSelectionChange(next)
  }, [selectedIds, onSelectionChange])

  const show = (col: ColKey) => visible.has(col)

  if (contacts.length === 0) {
    return null // handled by parent empty state
  }

  return (
    <div>
      <div className="flex justify-end px-4 pt-2 pb-1">
        <ColumnToggle visible={visible} toggle={toggle} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wide">
              <th className="px-2 py-2 w-8">
                <input type="checkbox" checked={allOnPageSelected} onChange={toggleAll} className="accent-purple-500" />
              </th>
              {show('priority') && <th className="px-2 py-2 w-14 text-center">Pri.</th>}
              {show('status') && <th className="px-3 py-2 w-24">Status</th>}
              {show('niche') && <th className="px-3 py-2 w-36">Niche</th>}
              {show('name') && <th className="px-3 py-2 w-36">Name</th>}
              {show('title') && <th className="px-3 py-2 w-44">Title</th>}
              {show('company') && <th className="px-3 py-2 w-44">Company</th>}
              {show('industry') && <th className="px-3 py-2 w-36">Industry</th>}
              {show('email') && <th className="px-3 py-2 w-44">Email</th>}
              {show('phone') && <th className="px-3 py-2 w-32">Phone</th>}
              {show('linkedin') && <th className="px-2 py-2 w-10 text-center">Li</th>}
              {show('confidence') && <th className="px-3 py-2 w-16">Conf.</th>}
              {show('verif') && <th className="px-2 py-2 w-14 text-center" title="Verification">Verif.</th>}
              {show('site') && <th className="px-2 py-2 w-10 text-center" title="Website alive">Site</th>}
              {show('active') && <th className="px-2 py-2 w-10 text-center" title="Company active">Co.</th>}
              {show('person') && <th className="px-2 py-2 w-10 text-center" title="Person verified">Person</th>}
              {show('dm') && <th className="px-2 py-2 w-12 text-center" title="Decision maker score">DM</th>}
              {show('last_verified') && <th className="px-2 py-2 w-20 text-center">Verified</th>}
              <th className="px-3 py-2 w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <ContactRow
                key={c.id}
                contact={c}
                visible={visible}
                selected={selectedIds.has(c.id)}
                onSelect={handleSelect}
                minConfidence={minConfidence}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}