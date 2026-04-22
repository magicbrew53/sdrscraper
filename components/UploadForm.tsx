'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ProgressBar from './ProgressBar'

export default function UploadForm() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadId, setUploadId] = useState<string | null>(null)

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith('.csv')) {
      setError('Please select a CSV file.')
      return
    }
    setFile(f)
    setError(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const f = e.dataTransfer.files[0]
      if (f) handleFile(f)
    },
    [handleFile]
  )

  const estimateRows = (f: File): string => {
    const kb = f.size / 1024
    const estimated = Math.round(kb / 0.5) // rough estimate
    return estimated > 0 ? `~${estimated.toLocaleString()} rows` : ''
  }

  const handleSubmit = async () => {
    if (!file) return
    setUploading(true)
    setError(null)

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      let data: Record<string, unknown> = {}
      try {
        data = await res.json()
      } catch {
        throw new Error(`Server error (HTTP ${res.status}) — check server logs`)
      }
      if (!res.ok) throw new Error((data.error as string) || `Upload failed (HTTP ${res.status})`)
      setUploadId(data.uploadId as string)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setUploading(false)
    }
  }

  if (uploadId) {
    return (
      <ProgressBar
        uploadId={uploadId}
        onComplete={() => router.push(`/results?upload_id=${uploadId}`)}
      />
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center cursor-pointer hover:border-gray-400 transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
        {file ? (
          <div className="space-y-1">
            <p className="text-white font-medium">{file.name}</p>
            <p className="text-gray-400 text-sm">
              {(file.size / 1024).toFixed(1)} KB · {estimateRows(file)}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-gray-300">Drop Apollo CSV here or click to browse</p>
            <p className="text-gray-500 text-sm">Supports Apollo.io export format</p>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 text-red-400 text-sm">{error}</p>
      )}

      {file && !uploading && (
        <button
          onClick={handleSubmit}
          className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
        >
          Upload &amp; Classify
        </button>
      )}

      {uploading && !uploadId && (
        <div className="mt-4 text-center space-y-2">
          <p className="text-gray-300 text-sm">Uploading and parsing CSV...</p>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div className="bg-purple-500 h-2 rounded-full animate-pulse w-full" />
          </div>
          <p className="text-gray-500 text-xs">This may take a minute for large files</p>
        </div>
      )}
    </div>
  )
}