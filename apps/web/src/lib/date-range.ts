export type DateRangePreset = 'today' | '7d' | '30d' | 'this_month' | 'this_quarter' | 'custom'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function fmt(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function getPresetRange(preset: DateRangePreset): { from: string; to: string } {
  const now = new Date()

  switch (preset) {
    case 'today': {
      const t = fmt(now)
      return { from: t, to: t }
    }
    case '7d': {
      const from = new Date(now)
      from.setDate(from.getDate() - 6)
      return { from: fmt(from), to: fmt(now) }
    }
    case '30d': {
      const from = new Date(now)
      from.setDate(from.getDate() - 29)
      return { from: fmt(from), to: fmt(now) }
    }
    case 'this_month': {
      const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
      return { from, to: fmt(now) }
    }
    case 'this_quarter': {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
      const from = new Date(now.getFullYear(), quarterStartMonth, 1)
      return { from: fmt(from), to: fmt(now) }
    }
    default:
      return { from: fmt(now), to: fmt(now) }
  }
}

export function defaultDateRange(): { from: string; to: string } {
  return getPresetRange('this_month')
}
