'use client'

import { useEffect, useRef, useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Armchair, ArrowCounterClockwise } from '@phosphor-icons/react'
import { moveSelfToDivers, undoMoveSelfToDivers } from '@/actions/student/seat-swap'
import type { MyPresence } from '@/data/student/profile'

const UNDO_WINDOW_MS = 60_000

export function PresenceBanner({ presence }: { presence: MyPresence }) {
  const router = useRouter()
  const [undoInfo, setUndoInfo] = useState<{ seatId: string; roomId: string } | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current)
    }
  }, [])

  const { execute: moveToDivers, status: moveStatus } = useAction(moveSelfToDivers, {
    onSuccess: ({ data }) => {
      if (data?.seatId && data.roomId) {
        setUndoInfo({ seatId: data.seatId, roomId: data.roomId })
        toast.success('Vous êtes maintenant en Divers')
        if (undoTimer.current) clearTimeout(undoTimer.current)
        undoTimer.current = setTimeout(() => setUndoInfo(null), UNDO_WINDOW_MS)
      }
      router.refresh()
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const { execute: undo, status: undoStatus } = useAction(undoMoveSelfToDivers, {
    onSuccess: () => {
      toast.success('Place reprise')
      if (undoTimer.current) clearTimeout(undoTimer.current)
      setUndoInfo(null)
      router.refresh()
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur')
      setUndoInfo(null)
    },
  })

  const isAbsent = presence.status === 'absent'
  const bg = isAbsent ? 'var(--synapse-cream-100)' : 'var(--synapse-green-50, #edfaf4)'
  const border = isAbsent ? 'var(--border-default)' : 'var(--synapse-green-200, #bbf7d0)'
  const iconBg = isAbsent ? 'var(--synapse-cream-200)' : 'var(--synapse-green-100, #dcfce7)'
  const labelColor = isAbsent ? 'var(--muted-foreground)' : 'var(--synapse-green-600, #16a34a)'
  const valueColor = isAbsent ? 'var(--text-secondary)' : 'var(--synapse-green-800, #166534)'

  return (
    <div className="space-y-2">
      <div
        className="rounded-xl flex items-center gap-3 px-4 py-3"
        style={{ background: bg, border: `1px solid ${border}` }}
      >
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-xl"
          style={{ width: 40, height: 40, background: iconBg }}
        >
          <Armchair size={20} weight="duotone" style={{ color: labelColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: labelColor }}>
            Présent
          </p>
          <p className="text-base font-bold leading-tight" style={{ fontFamily: 'var(--font-display)', color: valueColor }}>
            {presence.status === 'seated' ? (
              <>
                Place {presence.label}
                {presence.room && (
                  <span className="text-sm font-medium" style={{ color: labelColor }}>
                    {' '}· {presence.room}
                  </span>
                )}
              </>
            ) : presence.status === 'divers' ? (
              'Divers'
            ) : (
              'Absent'
            )}
          </p>
        </div>
        {presence.status === 'seated' && (
          <button
            onClick={() => moveToDivers({})}
            disabled={moveStatus === 'executing'}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}
          >
            Passer en Divers
          </button>
        )}
      </div>

      {undoInfo && (
        <button
          onClick={() => undo(undoInfo)}
          disabled={undoStatus === 'executing'}
          className="w-full flex items-center justify-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border"
          style={{ borderColor: 'var(--border-default)', color: 'var(--accent-brand)' }}
        >
          <ArrowCounterClockwise size={14} />
          Annuler — reprendre ma place
        </button>
      )}
    </div>
  )
}
