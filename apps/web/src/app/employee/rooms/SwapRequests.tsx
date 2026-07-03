'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { acceptSeatSwapRequest, denySeatSwapRequest } from '@/actions/employee/seat-swap'
import type { PendingSwapRequest } from '@/data/employee/seat-swap'

export function SwapRequests({ requests }: { requests: PendingSwapRequest[] }) {
  const router = useRouter()
  const [hidden, setHidden] = useState<string[]>([])

  const { execute: accept, status: acceptStatus } = useAction(acceptSeatSwapRequest, {
    onSuccess: ({ input }) => {
      toast.success('Changement de place effectué')
      setHidden((prev) => [...prev, input.requestId])
      router.refresh()
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur lors du changement de place'),
  })

  const { execute: deny, status: denyStatus } = useAction(denySeatSwapRequest, {
    onSuccess: ({ input }) => {
      toast.success('Demande refusée')
      setHidden((prev) => [...prev, input.requestId])
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const isPending = acceptStatus === 'executing' || denyStatus === 'executing'
  const visible = requests.filter((r) => !hidden.includes(r.id))
  if (visible.length === 0) return null

  return (
    <div
      style={{
        background: '#fff',
        border: '1.5px solid #22c55e',
        borderRadius: 'var(--radius-xl)',
        padding: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Demandes de changement de place</div>
        <span
          style={{
            fontSize: 12, fontWeight: 600, color: '#22c55e',
            background: 'rgba(34,197,94,0.1)', borderRadius: 99, padding: '3px 10px',
          }}
        >
          {visible.length}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((r) => (
          <div
            key={r.id}
            style={{
              border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)',
              padding: '10px 12px',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{r.studentName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
              {r.fromLabel ? `${r.fromRoom ?? '—'} · ${r.fromLabel}` : 'Divers'}
              {' → '}
              {r.toRoom ?? '—'} · {r.toLabel}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => accept({ requestId: r.id })}
                disabled={isPending}
                style={{
                  flex: 1, border: 'none', borderRadius: 'var(--radius-lg)',
                  padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: 'var(--accent-brand)', color: '#fff',
                }}
              >
                Accepter
              </button>
              <button
                onClick={() => deny({ requestId: r.id })}
                disabled={isPending}
                style={{
                  flex: 1, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)',
                  padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: 'none', color: 'var(--destructive)',
                }}
              >
                Refuser
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
