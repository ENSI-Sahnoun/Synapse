'use client'

import { useMemo, useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { differenceInMinutes, format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Session {
  id: string
  checked_in_at: string
  checked_out_at: string | null
  roomName: string
}

const MONTH_NAMES_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

// Always derive the day/month/year from the *local* representation of the
// timestamp — mixing UTC-sliced strings with local Date objects elsewhere
// caused late-night visits to appear under the wrong day/month.
function dayKey(iso: string): string {
  return format(parseISO(iso), 'yyyy-MM-dd')
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function formatDuration(checkedIn: string, checkedOut: string | null): string {
  if (!checkedOut) return 'En cours'
  const mins = differenceInMinutes(parseISO(checkedOut), parseISO(checkedIn))
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function StudentHistoryClient({ sessions }: { sessions: Session[] }) {
  const years = useMemo(
    () => [...new Set(sessions.map((s) => parseISO(s.checked_in_at).getFullYear()))].sort((a, b) => b - a),
    [sessions],
  )

  // Every "YYYY-MM" that has at least one visit, sorted chronologically —
  // this is what the calendar's prev/next arrows are allowed to land on.
  const visitedMonths = useMemo(() => {
    const set = new Set(sessions.map((s) => {
      const d = parseISO(s.checked_in_at)
      return monthKey(d.getFullYear(), d.getMonth())
    }))
    return [...set].sort()
  }, [sessions])

  const defaultMonth = useMemo(() => {
    const now = new Date()
    const currentKey = monthKey(now.getFullYear(), now.getMonth())
    if (visitedMonths.includes(currentKey)) return currentKey
    return visitedMonths[visitedMonths.length - 1] ?? currentKey
  }, [visitedMonths])

  const [displayMonthKey, setDisplayMonthKey] = useState(defaultMonth)
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined)

  const [displayYear, displayMonth] = displayMonthKey.split('-').map(Number)

  function goToMonth(year: number, month: number) {
    setDisplayMonthKey(monthKey(year, month))
    setSelectedDay(undefined)
  }

  // react-day-picker calls this with the calendar's literal next/previous
  // month even if it has no visits — snap to the nearest visited month in
  // the direction the user navigated, instead of showing an empty page.
  function handleMonthChange(newMonth: Date) {
    const targetKey = monthKey(newMonth.getFullYear(), newMonth.getMonth())
    if (targetKey > displayMonthKey) {
      const next = visitedMonths.find((k) => k >= targetKey)
      if (next) goToMonth(...(next.split('-').map(Number) as [number, number]))
    } else if (targetKey < displayMonthKey) {
      const prev = [...visitedMonths].reverse().find((k) => k <= targetKey)
      if (prev) goToMonth(...(prev.split('-').map(Number) as [number, number]))
    }
  }

  const monthsInYear = useMemo(
    () => visitedMonths.filter((k) => k.startsWith(`${displayYear}-`)).map((k) => Number(k.split('-')[1])),
    [visitedMonths, displayYear],
  )

  const monthSessions = useMemo(
    () => sessions.filter((s) => {
      const d = parseISO(s.checked_in_at)
      return d.getFullYear() === displayYear && d.getMonth() === displayMonth
    }),
    [sessions, displayYear, displayMonth],
  )

  const visitedDayKeys = useMemo(() => new Set(monthSessions.map((s) => dayKey(s.checked_in_at))), [monthSessions])
  const visitedDates = useMemo(() => [...visitedDayKeys].map((k) => new Date(k + 'T00:00:00')), [visitedDayKeys])

  const selectedDaySessions = useMemo(() => {
    if (!selectedDay) return []
    const key = format(selectedDay, 'yyyy-MM-dd')
    return monthSessions.filter((s) => dayKey(s.checked_in_at) === key)
  }, [monthSessions, selectedDay])

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border py-12 text-center text-sm" style={{ background: 'white', borderColor: 'var(--border-subtle)', color: 'var(--muted-foreground)' }}>
        Aucune visite enregistrée
      </div>
    )
  }

  const firstVisitedMonth = visitedMonths[0]
  const lastVisitedMonth = visitedMonths[visitedMonths.length - 1]
  const [fromYear, fromMonth] = firstVisitedMonth.split('-').map(Number)
  const [toYear, toMonth] = lastVisitedMonth.split('-').map(Number)

  return (
    <div className="space-y-4">
      {years.length > 1 && (
        <div className="rounded-xl border p-4" style={{ background: 'white', borderColor: 'var(--border-subtle)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted-foreground)' }}>Année</p>
          <div className="grid grid-cols-3 gap-2.5">
            {years.map((year) => {
              const isSelected = displayYear === year
              // Jump to that year's most recent visited month
              const yearMonths = visitedMonths.filter((k) => k.startsWith(`${year}-`))
              const targetMonth = Number(yearMonths[yearMonths.length - 1].split('-')[1])
              return (
                <button
                  key={year}
                  onClick={() => goToMonth(year, targetMonth)}
                  className="rounded-xl font-bold"
                  style={{
                    padding: '16px 8px',
                    fontSize: 17,
                    background: isSelected ? 'var(--accent-brand)' : 'var(--synapse-cream-50, #faf8f5)',
                    color: isSelected ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {year}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {monthsInYear.length > 1 && (
        <div className="rounded-xl border p-4" style={{ background: 'white', borderColor: 'var(--border-subtle)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted-foreground)' }}>Mois — {displayYear}</p>
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 12 }, (_, m) => m).map((month) => {
              const visited = monthsInYear.includes(month)
              const isSelected = displayMonth === month
              return (
                <button
                  key={month}
                  disabled={!visited}
                  onClick={() => goToMonth(displayYear, month)}
                  className="rounded-xl font-bold"
                  style={{
                    padding: '14px 6px',
                    fontSize: 14,
                    background: isSelected ? 'var(--accent-brand)' : visited ? 'var(--synapse-green-50, #f0faf4)' : 'var(--synapse-cream-50, #faf8f5)',
                    color: isSelected ? '#fff' : visited ? 'var(--synapse-green-600, #16a34a)' : 'var(--muted-foreground)',
                    opacity: visited ? 1 : 0.5,
                    cursor: visited ? 'pointer' : 'not-allowed',
                  }}
                >
                  {MONTH_NAMES_FR[month]}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="relative isolate flex justify-center" style={{ padding: '12px 4px' }}>
        <Calendar
          mode="single"
          month={new Date(displayYear, displayMonth, 1)}
          onMonthChange={handleMonthChange}
          startMonth={new Date(fromYear, fromMonth, 1)}
          endMonth={new Date(toYear, toMonth, 1)}
          showOutsideDays={false}
          selected={selectedDay}
          onSelect={setSelectedDay}
          modifiers={{ visited: visitedDates }}
          modifiersClassNames={{ visited: 'bg-[var(--synapse-green-50,#f0faf4)] text-[var(--synapse-green-600,#16a34a)] font-bold' }}
          disabled={(date) => !visitedDayKeys.has(format(date, 'yyyy-MM-dd'))}
          locale={fr}
          className="w-full [--cell-size:2.5rem]"
          classNames={{ today: 'bg-[var(--synapse-green-500,#22c55e)] text-white rounded-md' }}
        />
      </div>

      {selectedDay && (
        <div className="relative isolate z-10 mt-4 clear-both rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: 'var(--border-subtle)' }}>
          <div className="px-4 py-3 border-b text-sm font-bold capitalize" style={{ borderColor: 'var(--border-subtle)' }}>
            {format(selectedDay, 'EEEE d MMMM yyyy', { locale: fr })}
          </div>
          {selectedDaySessions.map((s, i) => (
            <div
              key={s.id}
              className="flex items-center justify-between px-4 py-4"
              style={{ borderBottom: i < selectedDaySessions.length - 1 ? '1px solid var(--border-subtle)' : undefined }}
            >
              <div>
                <p className="text-base font-bold" style={{ color: s.roomName === 'Divers' ? 'var(--synapse-orange-600, #ea580c)' : s.roomName === 'Salle Inconnue' ? 'var(--destructive)' : 'var(--synapse-green-600, #16a34a)' }}>
                  {s.roomName}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  {format(parseISO(s.checked_in_at), 'HH:mm')}
                  {s.checked_out_at && ` → ${format(parseISO(s.checked_out_at), 'HH:mm')}`}
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'var(--synapse-cream-100)', color: 'var(--synapse-brown-600)' }}>
                {formatDuration(s.checked_in_at, s.checked_out_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
