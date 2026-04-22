'use client'

import { useEffect, useState } from 'react'

interface Props {
  uploadId: string
  onComplete: () => void
}

export default function ProgressBar({ uploadId, onComplete }: Props) {
  const [classified, setClassified] = useState(0)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('processing')

  useEffect(() => {
    let done = false

    const poll = async () => {
      while (!done) {
        try {
          const res = await fetch(`/api/upload/${uploadId}/status`)
          const data = await res.json()
          setClassified(data.classified_count || 0)
          setTotal(data.total_contacts || 0)
          setStatus(data.status)

          if (data.status === 'complete' || data.status === 'failed') {
            done = true
            if (data.status === 'complete') {
              setTimeout(onComplete, 500)
            }
            return
          }
        } catch {
          // ignore transient errors
        }
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    poll()
    return () => { done = true }
  }, [uploadId, onComplete])

  const pct = total > 0 ? Math.round((classified / total) * 100) : 0

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <p className="text-gray-300">
        {status === 'failed'
          ? 'Classification failed. Please try again.'
          : `Classifying ${classified.toLocaleString()} of ${total.toLocaleString()} contacts...`}
      </p>
      <div className="w-full bg-gray-700 rounded-full h-3">
        <div
          className="bg-purple-500 h-3 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-gray-500 text-sm">{pct}% complete</p>
    </div>
  )
}