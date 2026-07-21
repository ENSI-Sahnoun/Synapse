'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAction } from 'next-safe-action/hooks'
import { formatDistanceToNow, parseISO, isPast, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cancelReservation, acceptReservation } from '@/actions/employee/reservations'
import { UserAvatar } from '@/components/user/UserAvatar'
import { toast } from 'sonner'
import { Check, X } from '@phosphor-icons/react'
import type { ActiveReservation } from '@/data/employee/reservations'

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || '?'
}

function ExpiryBadge({ expiresAt }: { expiresAt: string }) {
  const expired = isPast(parseISO(expiresAt))
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: 99,
        background: expired ? '#fee2e2' : '#f0fdf4',
        color: expired ? '#dc2626' : '#16a34a',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: expired ? '#dc2626' : '#16a34a',
          flexShrink: 0,
        }}
      />
      {expired
        ? 'Expirée'
        : formatDistanceToNow(parseISO(expiresAt), { addSuffix: true, locale: fr })}
    </span>
  )
}

export function ReservationsClient({ initialReservations }: { initialReservations: ActiveReservation[] }) {
  const [reservations, setReservations] = useState(initialReservations)

  const searchParams = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const [flashId, setFlashId] = useState<string | null>(highlightId)
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})

  useEffect(() => {
    if (!highlightId) return
    const row = rowRefs.current[highlightId]
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setFlashId(null), 2500)
    return () => clearTimeout(t)
  }, [highlightId])

  const { execute: cancel, status: cancelStatus } = useAction(cancelReservation, {
    onSuccess: ({ data, input }) => {
      if (data && 'error' in data) { toast.error(data.error); return }
      toast.success('Réservation annulée.')
      setReservations((prev) => prev.filter((r) => r.id !== input.reservationId))
    },
    onError: () => toast.error("Erreur lors de l'annulation."),
  })

  const { execute: accept, status: acceptStatus } = useAction(acceptReservation, {
    onSuccess: ({ data, input }) => {
      if (data && 'error' in data) { toast.error(data.error); return }
      toast.success('Réservation confirmée.')
      setReservations((prev) => prev.filter((r) => r.id !== input.reservationId))
    },
    onError: () => toast.error('Erreur lors de la confirmation.'),
  })

  const busy = cancelStatus === 'executing' || acceptStatus === 'executing'

  if (reservations.length === 0) {
    return (
      <div
        style={{
          background: 'white',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          padding: '56px 20px',
          textAlign: 'center',
          color: 'var(--muted-foreground)',
          fontSize: 14,
        }}
      >
        Aucune réservation active pour le moment.
      </div>
    )
  }

  return (
    <>
    <div
      className="hidden md:block"
      style={{
        background: 'white',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        overflow: 'auto',
      }}
    >
      <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--synapse-cream-50, #fafaf8)' }}>
              {['Étudiant', 'Salle · Place', 'Réservé à', 'Expire', 'File', 'Actions'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--muted-foreground)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reservations.map((r, i) => (
              <tr
                key={r.id}
                ref={(el) => { rowRefs.current[r.id] = el }}
                style={{
                  borderBottom: i < reservations.length - 1 ? '1px solid var(--border-subtle)' : undefined,
                  background: flashId === r.id ? '#fef9c3' : undefined,
                  transition: 'background 0.6s ease',
                }}
                onMouseEnter={(e) => { if (flashId !== r.id) e.currentTarget.style.background = 'var(--synapse-cream-50, #fafaf8)' }}
                onMouseLeave={(e) => { if (flashId !== r.id) e.currentTarget.style.background = 'transparent' }}
              >
                {/* Student */}
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <UserAvatar fullName={r.student_name} avatarUrl={r.avatarUrl} className="h-8.5 w-8.5" />
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {r.student_name}
                        {r.is_priority && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: 99,
                              background: 'var(--synapse-orange-100)',
                              color: 'var(--synapse-orange-600)',
                              letterSpacing: '0.05em',
                              textTransform: 'uppercase',
                            }}
                          >
                            Priorité
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Room · Seat */}
                <td style={{ padding: '12px 16px', color: 'var(--foreground)', fontWeight: 500 }}>
                  {r.room_name}
                  <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}> · </span>
                  {r.seat_label}
                </td>

                {/* Reserved at */}
                <td style={{ padding: '12px 16px', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
                  {format(parseISO(r.reserved_at), 'HH:mm', { locale: fr })}
                  <span style={{ display: 'block', fontSize: 11 }}>
                    {format(parseISO(r.reserved_at), 'd MMM', { locale: fr })}
                  </span>
                </td>

                {/* Expiry */}
                <td style={{ padding: '12px 16px' }}>
                  <ExpiryBadge expiresAt={r.expires_at} />
                </td>

                {/* Queue */}
                <td style={{ padding: '12px 16px', color: 'var(--muted-foreground)' }}>
                  {r.queue_position != null ? (
                    <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>#{r.queue_position}</span>
                  ) : (
                    <span style={{ color: 'var(--border-subtle)' }}>—</span>
                  )}
                </td>

                {/* Actions */}
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => accept({ reservationId: r.id })}
                      disabled={busy}
                      title="Confirmer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: '1px solid #bbf7d0',
                        background: '#f0fdf4',
                        color: '#15803d',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: busy ? 'not-allowed' : 'pointer',
                        opacity: busy ? 0.5 : 1,
                        transition: 'background 0.15s, border-color 0.15s',
                        fontFamily: 'var(--font-body)',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = '#dcfce7' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#f0fdf4' }}
                    >
                      <Check size={13} weight="bold" />
                      Confirmer
                    </button>
                    <button
                      onClick={() => cancel({ reservationId: r.id })}
                      disabled={busy}
                      title="Annuler"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: '1px solid #fecaca',
                        background: '#fef2f2',
                        color: '#dc2626',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: busy ? 'not-allowed' : 'pointer',
                        opacity: busy ? 0.5 : 1,
                        transition: 'background 0.15s, border-color 0.15s',
                        fontFamily: 'var(--font-body)',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = '#fee2e2' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#fef2f2' }}
                    >
                      <X size={13} weight="bold" />
                      Annuler
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
    </div>

    {/* Mobile: stacked cards — the desktop table's Confirmer/Annuler actions sat
        off the right edge on phones (the table has minWidth:700). */}
    <ul className="md:hidden space-y-3">
      {reservations.map((r) => (
        <li
          key={r.id}
          className="rounded-xl border p-3"
          style={{
            borderColor: 'var(--border-subtle)',
            background: flashId === r.id ? '#fef9c3' : 'white',
            transition: 'background 0.6s ease',
          }}
        >
          <div className="flex items-center gap-2.5">
            <UserAvatar fullName={r.student_name} avatarUrl={r.avatarUrl} className="h-8.5 w-8.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--foreground)' }}>
                <span className="truncate">{r.student_name}</span>
                {r.is_priority && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 99,
                      background: 'var(--synapse-orange-100)',
                      color: 'var(--synapse-orange-600)',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      flexShrink: 0,
                    }}
                  >
                    Priorité
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {r.room_name} · {r.seat_label}
                {r.queue_position != null && <> · File #{r.queue_position}</>}
              </div>
            </div>
            <ExpiryBadge expiresAt={r.expires_at} />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => accept({ reservationId: r.id })}
              disabled={busy}
              className="flex-1"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                minHeight: 44,
                borderRadius: 10,
                border: '1px solid #bbf7d0',
                background: '#f0fdf4',
                color: '#15803d',
                fontSize: 14,
                fontWeight: 600,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.5 : 1,
                fontFamily: 'var(--font-body)',
              }}
            >
              <Check size={16} weight="bold" />
              Confirmer
            </button>
            <button
              onClick={() => cancel({ reservationId: r.id })}
              disabled={busy}
              className="flex-1"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                minHeight: 44,
                borderRadius: 10,
                border: '1px solid #fecaca',
                background: '#fef2f2',
                color: '#dc2626',
                fontSize: 14,
                fontWeight: 600,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.5 : 1,
                fontFamily: 'var(--font-body)',
              }}
            >
              <X size={16} weight="bold" />
              Annuler
            </button>
          </div>
        </li>
      ))}
    </ul>
    </>
  )
}
