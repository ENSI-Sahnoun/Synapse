import { Badge } from '@/components/ui/badge'

type OccupancyLevel = 'empty' | 'quiet' | 'moderate' | 'nearly-full' | 'full'

const LEVEL_CONFIG: Record<OccupancyLevel, { label: string; className: string }> = {
  empty: {
    label: 'Vide',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  quiet: {
    label: 'Calme',
    className: 'bg-green-100 text-green-700 border-green-200',
  },
  moderate: {
    label: 'Modéré',
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  },
  'nearly-full': {
    label: 'Presque plein',
    className: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  full: {
    label: 'Complet',
    className: 'bg-red-100 text-red-700 border-red-200',
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
