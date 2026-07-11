'use client'

import { useState, useTransition } from 'react'
import { PaperPlaneTilt, Check } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { airdropQrCode } from '@/actions/student/airdrop-qr'

const COOLDOWN_MS = 10_000

export function SendCodeButton() {
  const [isPending, startTransition] = useTransition()
  const [onCooldown, setOnCooldown] = useState(false)

  function handleClick() {
    if (isPending || onCooldown) return
    startTransition(async () => {
      const result = await airdropQrCode({})
      if (result?.serverError) {
        toast.error(result.serverError)
        return
      }
      setOnCooldown(true)
      toast.success('Code envoyé au personnel.')
      setTimeout(() => setOnCooldown(false), COOLDOWN_MS)
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending || onCooldown}
      aria-label="Envoyer le code au personnel"
      title="Envoyer le code au personnel"
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-70"
      style={{
        color: onCooldown ? 'var(--synapse-green-700)' : 'var(--synapse-brown-600)',
        background: onCooldown ? 'var(--synapse-green-50)' : 'var(--synapse-brown-50)',
      }}
    >
      {onCooldown ? (
        <>
          <Check size={13} weight="bold" />
          Envoyé
        </>
      ) : (
        <>
          <PaperPlaneTilt size={13} weight="bold" />
          Envoyer
        </>
      )}
    </button>
  )
}
