import { Badge } from '@/components/ui/badge'

const STATUS_CONFIG = {
  open: { label: 'Ouvert', variant: 'default' as const, className: 'bg-green-100 text-green-800 border-green-200' },
  closed: { label: 'Fermé', variant: 'destructive' as const, className: '' },
  reserved: { label: 'Réservé', variant: 'secondary' as const, className: 'bg-orange-100 text-orange-800 border-orange-200' },
}

export function RoomStatusBadge({ status }: { status: 'open' | 'closed' | 'reserved' }) {
  const config = STATUS_CONFIG[status]
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}
