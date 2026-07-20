import { addDays, tunisDate } from '@/lib/tz'

export type DateRangePreset = 'today' | '7d' | '30d' | 'this_month' | 'this_quarter' | 'custom'

// Every preset resolves in Africa/Tunis, not the server's timezone. On Vercel
// the server runs UTC, so `new Date().getMonth()` rolled the month over an hour
// early: between 00:00 and 01:00 Tunis on the 1st, `this_month` still returned
// the previous month and the dashboard showed a full month of stale figures.

export function getPresetRange(preset: DateRangePreset): { from: string; to: string } {
  const today = tunisDate()

  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case '7d':
      return { from: addDays(today, -6), to: today }
    case '30d':
      return { from: addDays(today, -29), to: today }
    case 'this_month':
      return { from: `${today.slice(0, 7)}-01`, to: today }
    case 'this_quarter': {
      const month = Number(today.slice(5, 7))
      const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1
      return { from: `${today.slice(0, 4)}-${String(quarterStartMonth).padStart(2, '0')}-01`, to: today }
    }
    default:
      return { from: today, to: today }
  }
}

export function defaultDateRange(): { from: string; to: string } {
  return getPresetRange('this_month')
}
