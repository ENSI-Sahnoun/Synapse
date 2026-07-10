'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { openCashSessionAction } from '@/actions/employee/cash-sessions'

export function OpenSessionForm() {
  const router = useRouter()
  const [amount, setAmount] = useState('')

  const { execute, status } = useAction(openCashSessionAction, {
    onSuccess: () => {
      toast.success('Caisse ouverte')
      router.refresh()
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Erreur à l'ouverture de la caisse"),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = Number(amount)
    if (Number.isNaN(value) || value < 0) {
      toast.error('Montant invalide')
      return
    }
    execute({ opening_amount_dt: value })
  }

  return (
    <div style={{ padding: '16px', display: 'flex', justifyContent: 'center' }}>
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 380,
          background: '#fff',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: 24,
          marginTop: 40,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Ouverture de caisse</h2>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
            Aucune session de caisse n&apos;est ouverte. Indiquez le fond de caisse initial pour
            commencer à vendre.
          </p>
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Fond initial (DT)
          </label>
          <input
            autoFocus
            type="number"
            step="0.001"
            min="0"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.000"
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              fontSize: 16,
            }}
          />
        </div>
        <button
          type="submit"
          disabled={status === 'executing' || amount.trim() === ''}
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--accent-brand)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 15,
            border: 'none',
            cursor: status === 'executing' ? 'not-allowed' : 'pointer',
            opacity: status === 'executing' || amount.trim() === '' ? 0.6 : 1,
          }}
        >
          {status === 'executing' ? 'Ouverture...' : 'Ouvrir la caisse'}
        </button>
      </form>
    </div>
  )
}
