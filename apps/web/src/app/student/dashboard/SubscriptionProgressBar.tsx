/**
 * The remaining-time percentage is computed once on the server, so a CSS
 * transition on the server-rendered width never fires. The `progress-grow`
 * keyframe declares only its `from` state, so the server still paints the real
 * width and the fill simply animates up to it — a slow or failed hydration
 * shows the true remaining time rather than an empty bar. No hooks, so this
 * stays a server component.
 */
export function SubscriptionProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: 'var(--synapse-cream-200)' }}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${pct}%`,
          background: color,
          animation: 'progress-grow 500ms var(--ease-out)',
        }}
      />
    </div>
  )
}
