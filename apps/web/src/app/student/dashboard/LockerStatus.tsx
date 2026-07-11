interface Props {
  locker: { number: number } | null
}

export function LockerStatus({ locker }: Props) {
  if (!locker) return null

  return (
    <div
      className="rounded-xl border p-4 flex items-center gap-3"
      style={{ background: 'white', borderColor: 'var(--border-subtle)' }}
    >
      <span
        className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
        style={{ background: 'var(--synapse-green-50)', color: 'var(--synapse-green-500)' }}
      >
        Casier
      </span>
      <p className="text-sm font-semibold">Vous avez le casier numéro {locker.number}</p>
    </div>
  )
}
