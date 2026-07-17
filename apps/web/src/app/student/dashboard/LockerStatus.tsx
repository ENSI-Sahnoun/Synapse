import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { LockKey, ClockCountdown, WarningCircle } from '@phosphor-icons/react/dist/ssr'
import type { LockerBadgeState } from '@/lib/locker-status'

interface Props {
  locker: { number: number; endDate: string; badge: LockerBadgeState } | null
}

const STYLES: Record<
  LockerBadgeState,
  { bg: string; ring: string; color: string; icon: typeof LockKey; pulse: boolean }
> = {
  active: {
    bg: 'var(--synapse-green-50)',
    ring: 'var(--synapse-green-500)',
    color: 'var(--synapse-green-500)',
    icon: LockKey,
    pulse: true,
  },
  expiring_soon: { bg: '#fef3c7', ring: '#f59e0b', color: '#b45309', icon: ClockCountdown, pulse: false },
  expired: { bg: '#fee2e2', ring: '#ef4444', color: '#b91c1c', icon: WarningCircle, pulse: false },
}

export function LockerStatus({ locker }: Props) {
  if (!locker) return null

  const date = format(new Date(locker.endDate), 'dd/MM/yyyy', { locale: fr })
  const style = STYLES[locker.badge]
  const Icon = style.icon
  const text =
    locker.badge === 'expired'
      ? `Votre casier numéro ${locker.number} a expiré le ${date}, veuillez le libérer.`
      : `Vous avez le casier numéro ${locker.number} · expire le ${date}`

  return (
    <div
      className="rounded-xl border p-4 flex items-center gap-3 motion-safe:animate-[locker-in_0.4s_cubic-bezier(0.22,1,0.36,1)]"
      style={{ background: 'white', borderColor: 'var(--border-subtle)' }}
    >
      <span
        className="relative shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
        style={{ background: style.bg, color: style.color }}
      >
        {style.pulse && (
          <span
            className="absolute inset-0 rounded-full motion-safe:animate-ping"
            style={{ background: style.ring, opacity: 0.35 }}
          />
        )}
        <Icon size={18} weight="fill" className="relative" />
      </span>
      <p className="text-sm font-semibold">{text}</p>
      <style>{`
        @keyframes locker-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
