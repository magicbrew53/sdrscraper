'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'

interface Props {
  selectedIds?: Set<string>
}

interface Preview {
  total: number
  prevExportedCount: number
  earliestExport: string | null
}

export default function ExportButton({ selectedIds }: Props) {
  const searchParams = useSearchParams()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)

  const buildPreviewParams = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    params.delete('sort_by')
    params.delete('sort_dir')
    if (selectedIds && selectedIds.size > 0) {
      params.set('ids', [...selectedIds].join(','))
    }
    return params
  }, [searchParams, selectedIds])

  // Prefetch count when filters or selection change
  useEffect(() => {
    const params = buildPreviewParams()
    fetch(`/api/contacts/export/preview?${params.toString()}`)
      .then(r => r.json())
      .then(d => setPreview(d))
      .catch(() => setPreview(null))
  }, [buildPreviewParams])

  const doExport = (newOnly: boolean) => {
    const params = buildPreviewParams()
    if (newOnly) params.set('new_only', 'true')
    window.location.href = `/api/contacts/export?${params.toString()}`
    setShowModal(false)
  }

  const handleClick = async () => {
    setLoading(true)
    try {
      const params = buildPreviewParams()
      const res = await fetch(`/api/contacts/export/preview?${params.toString()}`)
      const data: Preview = await res.json()
      setPreview(data)
      setShowModal(true)
    } finally {
      setLoading(false)
    }
  }

  const count = preview?.total ?? 0
  const prevCount = preview?.prevExportedCount ?? 0
  const newCount = count - prevCount
  const label = selectedIds && selectedIds.size > 0
    ? `Download Selected (${selectedIds.size})`
    : `Download CSV${count > 0 ? ` (${count})` : ''}`

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading || count === 0}
        className="text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 px-4 py-2 rounded transition-colors whitespace-nowrap"
      >
        {loading ? 'Loading…' : label}
      </button>

      {showModal && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-sm w-full shadow-2xl">
            <h2 className="text-white font-semibold text-base mb-3">Export Contacts</h2>

            <div className="text-sm text-gray-300 space-y-1 mb-4">
              <p>Total matching: <span className="text-white font-medium">{count.toLocaleString()}</span></p>
              {prevCount > 0 && (
                <p className="text-yellow-400">
                  ⚠ {prevCount.toLocaleString()} of these were previously exported
                  {preview.earliestExport
                    ? ` (first: ${new Date(preview.earliestExport).toLocaleDateString()})`
                    : ''}
                </p>
              )}
              {newCount > 0 && (
                <p>New / not yet exported: <span className="text-green-400 font-medium">{newCount.toLocaleString()}</span></p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => doExport(false)}
                className="w-full bg-blue-700 hover:bg-blue-600 text-white text-sm py-2 rounded transition-colors"
              >
                Download All ({count.toLocaleString()})
              </button>
              {prevCount > 0 && newCount > 0 && (
                <button
                  onClick={() => doExport(true)}
                  className="w-full bg-green-700 hover:bg-green-600 text-white text-sm py-2 rounded transition-colors"
                >
                  Download New Only ({newCount.toLocaleString()})
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