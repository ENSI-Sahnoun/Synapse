'use client'

import { useState } from 'react'
import { useQRScanner } from '@/hooks/use-qr-scanner'
import { signInWithQrAction } from '@/data/auth/auth'
import { useAction } from 'next-safe-action/hooks'
import { Camera, Keyboard } from '@phosphor-icons/react'
import { toast } from 'sonner'

export function QrLoginPanel({ onSuccess }: { onSuccess: (redirectTo: string) => void }) {
  const [manualOpen, setManualOpen] = useState(false)
  const [manualCode, setManualCode] = useState('')

  const { execute, status } = useAction(signInWithQrAction, {
    onSuccess: (payload) => {
      toast.success('Connexion réussie !')
      onSuccess(payload.data?.redirectTo ?? '/student/dashboard')
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Code QR invalide ou expiré.')
    },
  })

  const { videoRef, scanning, error: cameraError, startScan, stopScan } = useQRScanner(
    ({ text }) => {
      execute({ qr_token: text })
    }
  )

  const submitting = status === 'executing'

  return (
    <div className="space-y-4">
      {/* Viewfinder */}
      <div
        className="relative w-full overflow-hidden rounded-xl"
        style={{ aspectRatio: '4 / 3', background: 'var(--synapse-stone-900)' }}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" />

        {/* Corner brackets */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative" style={{ width: '58%', aspectRatio: '1' }}>
            {(['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2', 'bottom-0 left-0 border-b-2 border-l-2', 'bottom-0 right-0 border-b-2 border-r-2'] as const).map((pos) => (
              <span
                key={pos}
                className={`absolute h-6 w-6 rounded-[3px] ${pos}`}
                style={{ borderColor: 'var(--synapse-orange-400)' }}
              />
            ))}
          </div>
        </div>

        {!scanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            <Camera size={28} style={{ color: 'var(--synapse-cream-300)' }} />
            <p className="text-sm" style={{ color: 'var(--synapse-cream-200)' }}>
              {cameraError ?? 'Présentez la carte fournie par notre équipe'}
            </p>
            <button
              type="button"
              onClick={startScan}
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--accent-brand)' }}
            >
              Scanner ma carte
            </button>
          </div>
        )}

        {scanning && (
          <button
            type="button"
            onClick={stopScan}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{ background: 'rgba(0,0,0,0.55)', color: 'white' }}
          >
            Arrêter
          </button>
        )}
      </div>

      {/* Manual entry fallback */}
      <button
        type="button"
        onClick={() => setManualOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-medium"
        style={{ color: 'var(--text-brand)' }}
      >
        <Keyboard size={16} />
        Saisir le code manuellement
      </button>

      {manualOpen && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (manualCode.trim()) execute({ qr_token: manualCode })
          }}
        >
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            placeholder="SYNAPSE-XXXXXXXX"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="flex-1 rounded-lg border px-3 py-2.5 font-mono text-sm tracking-wider outline-none"
            style={{ borderColor: 'var(--border-default)', background: 'white' }}
          />
          <button
            type="submit"
            disabled={submitting || !manualCode.trim()}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: 'var(--accent-brand)' }}
          >
            {submitting ? '…' : 'Entrer'}
          </button>
        </form>
      )}

      <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
        La connexion par carte est réservée aux nouveaux comptes. Une fois votre
        mot de passe défini, connectez-vous avec votre email.
      </p>
    </div>
  )
}
