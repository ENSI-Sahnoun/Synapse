'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { PaperPlaneTilt, Copy, X } from '@phosphor-icons/react'
import { useQrAirdropFeed, type QrAirdrop } from '@/hooks/use-qr-airdrop-feed'

const AUTO_DISMISS_MS = 6000

export function AirdropPopup() {
  const [drops, setDrops] = useState<QrAirdrop[]>([])
  const router = useRouter()
  const pathname = usePathname()

  useQrAirdropFeed((drop) => {
    setDrops((prev) => (prev.some((d) => d.id === drop.id) ? prev : [...prev, drop]))
    setTimeout(() => {
      setDrops((prev) => prev.filter((d) => d.id !== drop.id))
    }, AUTO_DISMISS_MS)
  })

  function dismiss(id: string) {
    setDrops((prev) => prev.filter((d) => d.id !== id))
  }

  function handleUse(drop: QrAirdrop) {
    const isAdmin = window.location.pathname.startsWith('/admin')
    const isPos = window.location.pathname.includes('/pos')
    if (isPos) {
      window.dispatchEvent(new CustomEvent('pos-airdrop-token', { detail: drop.qrToken }))
    } else if (!window.location.pathname.includes('/checkin')) {
      sessionStorage.setItem('airdropQrToken', drop.qrToken)
      router.push(isAdmin ? '/admin/checkin' : '/employee/checkin')
    }
    dismiss(drop.id)
  }

  async function handleCopy(drop: QrAirdrop) {
    await navigator.clipboard.writeText(drop.qrToken)
    dismiss(drop.id)
  }

  // CheckinClient (employee/checkin and admin/checkin) already listens to the
  // same feed and auto-fills the code inline — showing the popup there too
  // makes every airdrop look like it fired twice.
  if (pathname?.startsWith('/kiosk') || pathname?.endsWith('/checkin')) return null

  if (drops.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2" style={{ maxWidth: 320 }}>
      <AnimatePresence initial={false}>
        {drops.map((drop) => (
          <motion.div
            key={drop.id}
            layout
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl border p-3 shadow-lg"
            style={{ background: 'var(--popover)', borderColor: 'var(--border-default)' }}
          >
            <div className="flex items-start gap-2">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ background: 'var(--synapse-brown-50)', color: 'var(--synapse-brown-600)' }}
              >
                <PaperPlaneTilt size={16} weight="fill" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {drop.studentName} a envoyé son code.
                </p>
                <p
                  className="mt-1 text-xs font-mono break-all rounded-md px-2 py-1"
                  style={{ background: 'var(--muted)' }}
                >
                  {drop.qrToken}
                </p>
              </div>
              <button
                onClick={() => dismiss(drop.id)}
                aria-label="Fermer"
                className="shrink-0 -m-1 p-1 rounded-full hover:bg-muted"
              >
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => void handleCopy(drop)}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
              >
                <Copy size={13} />
                Copier
              </button>
              <button
                onClick={() => handleUse(drop)}
                className="flex-1 rounded-md px-2 py-1.5 text-xs font-semibold text-white"
                style={{ background: 'var(--accent-brand)' }}
              >
                Utiliser
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
