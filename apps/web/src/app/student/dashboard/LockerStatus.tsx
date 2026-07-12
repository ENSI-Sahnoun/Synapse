import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { LockerBadgeState } from '@/lib/locker-status'

interface Props {
  locker: { number: number; endDate: string; badge: LockerBadgeState } | null
}

const STYLES: Record<LockerBadgeState, { bg: string; color: string }> = {
  active: { bg: 'var(--synapse-green-50)', color: 'var(--synapse-green-500)' },
  expiring_soon: { bg: '#fef3c7', color: '#b45309' },
  expired: { bg: '#fee2e2', color: '#b91c1c' },
}

export function LockerStatus({ locker }: Props) {
  if (!locker) return null

  const date = format(new Date(locker.endDate), 'dd/MM/yyyy', { locale: fr })
  const style = STYLES[locker.badge]
  const text =
    locker.badge === 'expired'
      ? `Votre casier numéro ${locker.number} a expiré le ${date}, veuillez le libérer.`
      : `Vous avez le casier numéro ${locker.number} · expire le ${date}`

  return (
    <div
      className="rounded-xl border p-4 flex items-center gap-3"
      style={{ background: 'white', borderColor: 'var(--border-subtle)' }}
    >
      <span
        className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
        style={{ background: style.bg, color: style.color }}
      >
        Casier
      </span>
      <p className="text-sm font-semibold">{text}</p>
    </div>
  )
}
