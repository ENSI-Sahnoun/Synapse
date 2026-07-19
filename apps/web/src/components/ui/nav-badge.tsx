interface NavBadgeProps {
  count?: number
  /** Overlay on an icon's corner (default) vs. inline within a row (sidebar). */
  overlay?: boolean
  /** Cap; anything above renders as `${max}+`. Default 9 (overlay), pass 99 for inline. */
  max?: number
}

/**
 * The red unread-count bubble shared by the mobile nav tabs, the "Plus" button,
 * and the desktop sidebar links. Single source of truth so the `N+` cap and the
 * destructive-token styling can't drift across call sites. Renders nothing at 0.
 */
export function NavBadge({ count, overlay = true, max = 9 }: NavBadgeProps) {
  if (!count) return null
  return (
    <span
      style={{
        ...(overlay
          ? { position: 'absolute', top: -4, right: -8, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, fontSize: 9 }
          : { minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, fontSize: 10 }),
        background: 'var(--destructive)',
        color: 'var(--destructive-foreground)',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {count > max ? `${max}+` : count}
    </span>
  )
}
