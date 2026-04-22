'use client'

import { useState, useEffect, useCallback } from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ContactTable from '@/components/ContactTable'
import Filters from '@/components/Filters'
import Pagination from '@/components/Pagination'
import ExportButton from '@/components/ExportButton'
import VerifyButton from '@/components/VerifyButton'
import type { Contact, Upload } from '@/lib/types'

interface Props {
  contacts: Contact[]
  total: number
  page: number
  totalPages: number
  uploads: Upload[]
  industries: string[]
  searchParams: Record<string, string>
  minConfidence: number
}

function ResultsShellInner({
  contacts,
  total,
  page,
  totalPages,
  uploads,
  industries,
  searchParams,
  minConfidence,
}: Props) {
  const router = useRouter()
  const urlSearchParams = useSearchParams()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [allFilteredIds, setAllFilteredIds] = useState<string[]>([])
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Fetch all filtered IDs (for select-all across pages)
  useEffect(() => {
    const params = new URLSearchParams(urlSearchParams.toString())
    params.delete('page')
    params.delete('sort_by')
    params.delete('sort_dir')
    fetch(`/api/contacts/ids?${params.toString()}`)
      .then(r => r.json())
      .then(d => setAllFilteredIds(d.ids ?? []))
      .catch(() => setAllFilteredIds([]))
  }, [urlSearchParams])

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Delete ${selectedIds.size} selected contact${selectedIds.size === 1 ? '' : 's'}? This cannot be undone.`)) return
    setDeleting(true)

    // If all filtered contacts are selected, send filters instead of IDs
    const allSelected = allFilteredIds.length > 0 && selectedIds.size === allFilteredIds.length
    const payload = allSelected
      ? {
          filters: {
            upload_id: searchParams.upload_id || undefined,
            status: searchParams.status || undefined,
            niche: searchParams.niche || undefined,
            industry: searchParams.industry || undefined,
            search: searchParams.search || undefined,
            verification_status: searchParams.verification_status || undefined,
            hide_duplicates: searchParams.hide_duplicates !== 'false',
            exported: searchParams.exported || undefined,
            min_confidence: searchParams.min_confidence ? Number(searchParams.min_confidence) : null,
          }
        }
      : { ids: [...selectedIds] }

    try {
      const res = await fetch('/api/contacts/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        setDeleteError(data.error || `Delete failed (${res.status})`)
        return
      }
      setDeleteError(null)
      setSelectedIds(new Set())
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }, [selectedIds, allFilteredIds, searchParams, router])

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">MQS Lead Verifier</h1>
          <p className="text-xs text-gray-500">
            {total.toLocaleString()} contacts
            {searchParams.status && searchParams.status !== 'All' ? ` · ${searchParams.status}` : ''}
            {selectedIds.size > 0 ? ` · ${selectedIds.size} selected` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {deleteError && <span className="text-xs text-red-400">{deleteError}</span>}
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="text-sm bg-red-800 hover:bg-red-700 disabled:opacity-40 text-white px-4 py-2 rounded transition-colors whitespace-nowrap"
            >
              {deleting ? 'Deleting…' : `Delete Selected (${selectedIds.size})`}
            </button>
          )}
          <Suspense>
            <ExportButton selectedIds={selectedIds} />
          </Suspense>
          <Suspense>
            <VerifyButton selectedIds={selectedIds} />
          </Suspense>
          <Link
            href="/"
            className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded transition-colors"
          >
            + Upload
          </Link>
        </div>
      </header>

      <div className="px-6 py-4 border-b border-gray-800">
        <Suspense>
          <Filters uploads={uploads} industries={industries} />
        </Suspense>
      </div>

      <div className="flex-1 overflow-auto">
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-500">
            <p className="text-lg mb-2">No contacts match these filters</p>
            <p className="text-sm">Try adjusting the status, niche, or confidence threshold.</p>
          </div>
        ) : (
          <>
            <ContactTable
              contacts={contacts}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              minConfidence={minConfidence}
              total={total}
              allFilteredIds={allFilteredIds}
              onDeleteSelected={handleDeleteSelected}
            />
            <Pagination
              page={page}
              totalPages={totalPages}
              searchParams={searchParams}
            />
          </>
        )}
      </div>
    </main>
  )
}

export default function ResultsShell(props: Props) {
  return (
    <Suspense>
      <ResultsShellInner {...props} />
    </Suspense>
  )
}
