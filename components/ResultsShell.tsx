'use client'

import { useState } from 'react'
import { Suspense } from 'react'
import { useRouter } from 'next/navigation'
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

export default function ResultsShell({
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Delete ${selectedIds.size} selected contact${selectedIds.size === 1 ? '' : 's'}? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await fetch('/api/contacts/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds] }),
      })
      setSelectedIds(new Set())
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

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