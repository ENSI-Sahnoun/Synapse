import { Badge } from '@/components/ui/badge'

type OccupancyLevel = 'empty' | 'quiet' | 'moderate' | 'nearly-full' | 'full'

const LEVEL_CONFIG: Record<OccupancyLevel, { label: string; className: string }> = {
  empty: {
    label: 'Vide',
    className:
      'bg-[var(--synapse-stone-100)] text-[var(--synapse-stone-600)] border-[var(--synapse-stone-200)]',
  },
  quiet: {
    label: 'Calme',
    className:
      'bg-[var(--synapse-green-100)] text-[var(--synapse-green-700)] border-[var(--synapse-green-200)]',
  },
  moderate: {
    label: 'Modéré',
    className: 'bg-[var(--warning-bg)] text-[var(--warning-text)] border-[var(--warning-border)]',
  },
  'nearly-full': {
    label: 'Presque plein',
    className:
      'bg-[var(--synapse-orange-100)] text-[var(--synapse-orange-700)] border-[var(--synapse-orange-200)]',
  },
  full: {
    label: 'Complet',
    className: 'bg-[var(--error-bg)] text-[var(--error-text)] border-[var(--error-border)]',
  },
}

function getOccupancyLevel(occupiedCount: number, totalSeats: number): OccupancyLevel {
  if (totalSeats === 0 || occupiedCount === 0) return 'empty'
  const pct = occupiedCount / totalSeats
  if (pct <= 0.40) return 'quiet'
  if (pct <= 0.70) return 'moderate'
  if (pct <= 0.90) return 'nearly-full'
  return 'full'
}

type Props = {
  occupiedCount: number
  totalSeats: number
  showCount?: boolean
}

export function CapacityBadge({ occupiedCount, totalSeats, showCount = true }: Props) {
  const level = getOccupancyLevel(occupiedCount, totalSeats)
  const config = LEVEL_CONFIG[level]

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
      {showCount && totalSeats > 0 && (
        <span className="ml-1 font-normal opacity-75">
          ({occupiedCount}/{totalSeats})
        </span>
      )}
    </Badge>
  )
}
