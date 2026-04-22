'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

interface JobStatus {
  total: number
  completed: number
  current_step: string
  status: string
}

const STEP_LABELS: Record<string, string> = {
  website: 'Checking websites',
  company: 'Verifying companies',
  done: 'Complete',
}

interface Props {
  onComplete?: () => void
  selectedIds?: Set<string>
}

export default function VerifyButton({ onComplete, selectedIds }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [eligibleCount, setEligibleCount] = useState<number | null>(null)
  const [alreadyVerifiedCount, setAlreadyVerifiedCount] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (selectedIds && selectedIds.size > 0) {
      params.set('ids', [...selectedIds].join(','))
    }
    fetch(`/api/verify?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        setEligibleCount(d.eligibleCount ?? 0)
        setAlreadyVerifiedCount(d.alreadyVerifiedCount ?? 0)
      })
      .catch(() => setEligibleCount(0))
  }, [searchParams, selectedIds])

  useEffect(() => {
    if (!jobId) return
    let cancelled = false

    const poll = async () => {
      while (!cancelled) {
        await new Promise(r => setTimeout(r, 2500))
        try {
          const res = await fetch(`/api/verify/${jobId}/status`)
          const data: JobStatus = await res.json()
          if (!cancelled) setJobStatus(data)
          if (data.status === 'complete' || data.status === 'failed') {
            cancelled = true
            setRunning(false)
            setJobId(null)
            setJobStatus(null)
            router.refresh()
            onComplete?.()
          }
        } catch {
          // ignore transient errors
        }
      }
    }

    poll()
    return () => { cancelled = true }
  }, [jobId, router, onComplete])

  const startVerify = async (verifyAll: boolean) => {
    setShowModal(false)
    setRunning(true)
    setError(null)

    const filters: Record<string, string | string[]> = {}
    for (const [k, v] of searchParams.entries()) {
      if (['upload_id', 'status', 'niche', 'industry', 'search'].includes(k)) {
        filters[k] = v
      }
    }
    if (selectedIds && selectedIds.size > 0) {
      filters.ids = [...selectedIds]
    }
    if (!verifyAll) filters.new_only = 'true'

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start verification')
      setJobId(data.jobId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
      setRunning(false)
    }
  }

  const handleVerify = () => {
    if (!eligibleCount) return
    if (alreadyVerifiedCount > 0) {
      setShowModal(true)
    } else {
      startVerify(true)
    }
  }

  if (running && jobStatus) {
    const pct = jobStatus.total > 0
      ? Math.round((jobStatus.completed / jobStatus.total) * 100)
      : 0
    const stepLabel = STEP_LABELS[jobStatus.current_step] ?? jobStatus.current_step
    return (
      <div className="flex items-center gap-3">
        <div className="text-xs text-gray-400 whitespace-nowrap">
          {stepLabel}… {jobStatus.completed}/{jobStatus.total}
        </div>
        <div className="w-28 bg-gray-700 rounded-full h-2">
          <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  if (running) {
    return <span className="text-xs text-gray-400 animate-pulse">Starting verification…</span>
  }

  const hasSelection = selectedIds && selectedIds.size > 0
  const btnLabel = hasSelection
    ? `Verify Selected (${eligibleCount ?? '…'})`
    : `Verify Filtered${eligibleCount !== null ? ` (${eligibleCount})` : ''}`

  return (
    <>
      <div className="flex items-center gap-2">
        {error && <span className="text-xs text-red-400">{error}</span>}
        <button
          onClick={handleVerify}
          disabled={!eligibleCount}
          title={!eligibleCount ? 'No eligible contacts (Fit/Maybe, unverified)' : undefined}
          className="text-sm bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded transition-colors whitespace-nowrap"
        >
          {btnLabel}
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-sm w-full shadow-2xl">
            <h2 className="text-white font-semibold text-base mb-3">Run Verification</h2>
            <div className="text-sm text-gray-300 space-y-1 mb-4">
              <p>Eligible contacts: <span className="text-white font-medium">{eligibleCount}</span></p>
              {alreadyVerifiedCount > 0 && (
                <p className="text-yellow-400">
                  ⚠ {alreadyVerifiedCount} of these were already verified and will be re-run.
                </p>
              )}
              <p className="text-gray-400 text-xs pt-1">Website checks are fast. Google search checks may take several minutes.</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => startVerify(true)}
                className="w-full bg-blue-700 hover:bg-blue-600 text-white text-sm py-2 rounded transition-colors"
              >
                Verify All ({eligibleCount})
              </button>
              {alreadyVerifiedCount > 0 && (eligibleCount ?? 0) - alreadyVerifiedCount > 0 && (
                <button
                  onClick={() => startVerify(false)}
                  className="w-full bg-green-700 hover:bg-green-600 text-white text-sm py-2 rounded transition-colors"
                >
                  Verify New Only ({(eligibleCount ?? 0) - alreadyVerifiedCount})
                </button>
              )}
              <button
                onClick={() => setShowModal(false)}
                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm py-2 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}