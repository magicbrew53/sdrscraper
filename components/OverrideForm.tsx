'use client'

import { useState } from 'react'
import { MQS_NICHES } from '@/lib/types'

interface Props {
  contactId: string
  currentStatus: string
  currentNiche: string | null
  onSaved: (override: { override_status: string; override_niche: string; override_reason: string }) => void
  onCancel: () => void
}

export default function OverrideForm({ contactId, currentStatus, currentNiche, onSaved, onCancel }: Props) {
  const [status, setStatus] = useState(currentStatus)
  const [niche, setNiche] = useState(currentNiche || 'None')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await fetch(`/api/contacts/${contactId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ override_status: status, override_niche: niche, override_reason: reason }),
    })
    setSaving(false)
    onSaved({ override_status: status, override_niche: niche, override_reason: reason })
  }

  return (
    <div className="bg-gray-800 border border-gray-600 rounded p-3 space-y-2 mt-1">
      <div className="flex flex-wrap gap-2">
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="bg-gray-700 border border-gray-500 text-gray-200 text-sm rounded px-2 py-1"
        >
          <option value="Fit">Fit</option>
          <option value="Maybe">Maybe</option>
          <option value="Not a Fit">Not a Fit</option>
        </select>
        <select
          value={niche}
          onChange={e => setNiche(e.target.value)}
          className="bg-gray-700 border border-gray-500 text-gray-200 text-sm rounded px-2 py-1"
        >
          <option value="None">None</option>
          {MQS_NICHES.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <input
          type="text"
          placeholder="Reason (optional)"
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="bg-gray-700 border border-gray-500 text-gray-200 text-sm rounded px-2 py-1 flex-1 min-w-[160px]"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm px-3 py-1 rounded"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="bg-gray-600 hover:bg-gray-500 text-white text-sm px-3 py-1 rounded"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}