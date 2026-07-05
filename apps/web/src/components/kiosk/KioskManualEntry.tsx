'use client'

import { useState, useCallback } from 'react'

const PREFIX = 'SYNAPSE-'

interface KioskManualEntryProps {
  onSubmit: (token: string) => void
  disabled?: boolean
}

// Fallback for when a camera scan fails or is unavailable: the student reads
// the code printed under their QR and types it. We accept the bare 8-char
// suffix or the full SYNAPSE-XXXXXXXX token; both normalise to the same value
// the scanner would have produced, so it flows through the identical checkin.
export function KioskManualEntry({ onSubmit, disabled }: KioskManualEntryProps) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (disabled) return
      const normalized = code.trim().toUpperCase().replace(/\s+/g, '')
      if (!normalized) return
      const token = normalized.startsWith(PREFIX) ? normalized : `${PREFIX}${normalized}`
      onSubmit(token)
      setCode('')
      setOpen(false)
    },
    [code, disabled, onSubmit]
  )

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-gray-500 text-xs underline underline-offset-4 hover:text-gray-300"
      >
        Saisir le code manuellement
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col items-center gap-3">
      <div className="flex w-full items-stretch rounded-lg border border-gray-700 bg-gray-900 overflow-hidden">
        <span className="flex items-center px-3 text-gray-500 text-sm select-none">
          {PREFIX}
        </span>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={16}
          placeholder="XXXXXXXX"
          className="flex-1 bg-transparent py-3 pr-3 text-white text-sm tracking-widest uppercase focus:outline-none placeholder:text-gray-600 placeholder:tracking-widest"
        />
      </div>
      <div className="flex w-full gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setCode('')
          }}
          className="flex-1 rounded-lg border border-gray-700 py-2 text-gray-400 text-xs"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={disabled || !code.trim()}
          className="flex-1 rounded-lg bg-white py-2 text-black text-xs font-semibold disabled:opacity-40"
        >
          Valider
        </button>
      </div>
    </form>
  )
}
