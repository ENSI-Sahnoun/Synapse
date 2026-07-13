'use client'

import { useMemo } from 'react'
import { format, startOfWeek, addDays } from 'date-fns'

interface DayHours {
  date: string // yyyy-MM-dd
  hours: number
}

const WEEKS = 26 // ~6 months, GitHub-style

// Buckets scale like GitHub's contribution graph: 0 / light / medium / heavy.
function level(hours: number): 0 | 1 | 2 | 3 | 4 {
  if (hours <= 0) return 0
  if (hours < 2) return 1
  if (hours < 4) return 2
  if (hours < 7) return 3
  return 4
}

const LEVEL_COLOR = [
  'var(--border-subtle)',
  'var(--synapse-green-100, #dcfce7)',
  'var(--synapse-green-300, #86efac)',
  'var(--synapse-green-500, #22c55e)',
  'var(--synapse-green-700, #15803d)',
]

export function EmployeeAttendanceHeatmap({ daily }: { daily: DayHours[] }) {
  const byDate = useMemo(() => new Map(daily.map((d) => [d.date, d.hours])), [daily])

  const today = new Date()
  const gridStart = startOfWeek(addDays(today, -7 * (WEEKS - 1)), { weekStartsOn: 1 })

  const weeks = useMemo(() => {
    const cols: { date: Date; hours: number }[][] = []
    for (let w = 0; w < WEEKS; w++) {
      const col: { date: Date; hours: number }[] = []
      for (let d = 0; d < 7; d++) {
        const date = addDays(gridStart, w * 7 + d)
        const key = format(date, 'yyyy-MM-dd')
        col.push({ date, hours: byDate.get(key) ?? 0 })
      }
      cols.push(col)
    }
    return cols
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byDate])

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', gap: 3 }}>
        {weeks.map((col, w) => (
          <div key={w} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {col.map((cell, d) => {
              const isFuture = cell.date > today
              return (
                <div
                  key={d}
                  title={`${format(cell.date, 'dd/MM/yyyy')} — ${cell.hours.toFixed(1)}h`}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: isFuture ? 'transparent' : LEVEL_COLOR[level(cell.hours)],
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: 'var(--muted-foreground)' }}>
        <span>Moins</span>
        {LEVEL_COLOR.map((c, i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: 3, background: c }} />
        ))}
        <span>Plus</span>
      </div>
    </div>
  )
}

export type { DayHours }
