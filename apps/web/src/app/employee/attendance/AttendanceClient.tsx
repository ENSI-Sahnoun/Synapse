'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format, parseISO, differenceInMinutes } from 'date-fns'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { useAction } from 'next-safe-action/hooks'
import { checkoutAction } from '@/actions/checkin/checkout-action'

interface Session {
  id: string
  studentId: string | null
  studentName: string
  room: string
  seatLabel: string | null
  checkedInAt: string
  checkedOutAt: string | null
  status: 'in' | 'out'
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || '?'
}

function roomColor(room: string): string {
  if (room === 'Divers') return 'var(--synapse-orange-600, #ea580c)'
  if (room === 'Salle Inconnue') return 'var(--destructive)'
  return 'var(--synapse-green-600, #16a34a)'
}

function duration(checkedIn: string, checkedOut: string | null) {
  if (!checkedOut) return null
  const m = differenceInMinutes(parseISO(checkedOut), parseISO(checkedIn))
  const h = Math.floor(m / 60)
  const min = m % 60
  return h > 0 ? `${h}h ${min > 0 ? min + 'm' : ''}`.trim() : `${min}m`
}

export function AttendanceClient({ sessions: initialSessions }: { sessions: Session[] }) {
  const [sessions, setSessions] = useState(initialSessions)
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('in')
  const [q, setQ] = useState('')

  const { execute: executeCheckout } = useAction(checkoutAction, {
    onSuccess: ({ input }) => {
      const now = new Date().toISOString()
      setSessions((prev) =>
        prev.map((s) =>
          s.id === input?.attendanceId ? { ...s, status: 'out' as const, checkedOutAt: now } : s,
        ),
      )
    },
  })

  // A student can have several sessions today (left and came back) — only
  // their most recent session should count toward Présents/Sortis.
  const latestPerStudent = new Map<string, Session>()
  for (const s of sessions) {
    const key = s.studentId ?? s.id
    const prev = latestPerStudent.get(key)
    if (!prev || parseISO(s.checkedInAt) > parseISO(prev.checkedInAt)) {
      latestPerStudent.set(key, s)
    }
  }
  const latestSessions = [...latestPerStudent.values()]
  const currentlyIn = latestSessions.filter((s) => s.status === 'in').length
  const checkedOut = latestSessions.filter((s) => s.status === 'out').length

  const filtered = sessions.filter((s) => {
    const matchFilter = filter === 'all' || s.status === filter
    const matchQ = !q || s.studentName.toLowerCase().includes(q.toLowerCase())
    return matchFilter && matchQ
  })

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Présents', value: currentlyIn, color: 'var(--synapse-green-500)' },
          { label: 'Sortis', value: checkedOut, color: 'var(--muted-foreground)' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border p-4"
            style={{ background: 'white', borderColor: 'var(--border-subtle)' }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
              {s.label}
            </p>
            <p className="text-3xl font-bold mt-1" style={{ fontFamily: 'var(--font-display)', color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter + search */}
      <div className="flex gap-2">
        {(['all', 'in', 'out'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
            style={{
              borderColor: filter === f ? 'var(--accent-brand)' : 'var(--border-default)',
              background: filter === f ? 'var(--accent-brand)' : 'white',
              color: filter === f ? 'white' : 'var(--muted-foreground)',
            }}
          >
            {f === 'all' ? 'Tous' : f === 'in' ? 'Présents' : 'Sortis'}
          </button>
        ))}
        <div className="relative flex-1">
          <MagnifyingGlass
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--muted-foreground)' }}
          />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher…"
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-full border outline-none"
            style={{
              borderColor: 'var(--border-default)',
              background: 'white',
              fontFamily: 'var(--font-body)',
            }}
          />
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: 'var(--border-subtle)' }}>
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Aucun résultat
          </p>
        )}
        {filtered.map((s, i) => (
          <div
            key={s.id}
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : undefined }}
          >
            <Link
              href={s.studentId ? `/employee/students?studentId=${s.studentId}` : '#'}
              className="flex flex-1 min-w-0 items-center gap-3"
              style={{ pointerEvents: s.studentId ? 'auto' : 'none', textDecoration: 'none', color: 'inherit' }}
            >
              {/* Avatar */}
              <div
                className="flex-shrink-0 flex items-center justify-center rounded-full text-white text-xs font-bold"
                style={{ width: 38, height: 38, background: s.status === 'in' ? 'var(--accent-brand)' : 'var(--synapse-stone-400)' }}
              >
                {initials(s.studentName)}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{s.studentName}</p>
                {s.status === 'in' && (
                  <p className="text-sm font-bold truncate mt-0.5" style={{ color: roomColor(s.room) }}>
                    {s.room}{s.seatLabel ? ` · ${s.seatLabel}` : ''}
                  </p>
                )}
                <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>
                  {s.status === 'out' && `${s.room}${s.seatLabel ? ` · ${s.seatLabel}` : ''} · `}
                  {format(parseISO(s.checkedInAt), 'HH:mm')}
                  {s.checkedOutAt && ` → ${format(parseISO(s.checkedOutAt), 'HH:mm')}`}
                </p>
              </div>
            </Link>

            <div className="flex flex-col items-end gap-1">
              {s.status === 'in' ? (
                <>
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--synapse-green-50)', color: 'var(--synapse-green-500)' }}
                  >
                    Présent
                  </span>
                  <button
                    onClick={() => executeCheckout({ attendanceId: s.id })}
                    className="text-xs font-semibold border rounded-lg px-3 py-1 bg-transparent cursor-pointer"
                    style={{ borderColor: 'var(--border-default)', whiteSpace: 'nowrap' }}
                  >
                    Sortie
                  </button>
                </>
              ) : (
                <>
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--synapse-cream-100)', color: 'var(--muted-foreground)' }}
                  >
                    Sorti
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                    {duration(s.checkedInAt, s.checkedOutAt)}
                  </span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
