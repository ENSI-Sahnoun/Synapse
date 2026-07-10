'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { DotsThree, X, CaretDown, ChartBar } from '@phosphor-icons/react'
import { signOutAction } from '@/data/auth/sign-out'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { SidebarNavLink } from '@/components/ui/sidebar-nav-link'
import { RoutePrefetcher } from '@/components/RoutePrefetcher'
import type { NotificationRow } from '@/data/notifications/list'
import { ICON_MAP, type ResolvedNavItem } from '@/lib/nav-items'
import { useNotificationsFeed } from '@/hooks/use-notifications-feed'
import { countUnreadByHref } from '@/lib/notifications/nav-badges'
import Image from 'next/image'

interface Props {
  fullName: string
  role: string
  navItems: ResolvedNavItem[]
  initialNotifications: NotificationRow[]
  initialUnreadCount: number
  children: React.ReactNode
}

function MoreDrawer({ open, onClose, items, navCounts }: { open: boolean; onClose: () => void; items: ResolvedNavItem[]; navCounts: Record<string, number> }) {
  const router = useRouter()

  function navigate(href: string) {
    onClose()
    router.push(href)
  }

  return (
    <>
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40,
          }}
          onClick={onClose}
        />
      )}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          width: '100%',
          maxWidth: 480,
          background: '#fff',
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
          zIndex: 41,
          paddingBottom: 'env(safe-area-inset-bottom, 20px)',
          transition: 'transform 0.25s ease',
          transform: `translateX(-50%) translateY(${open ? '0' : '100%'})`,
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-default)', margin: '12px auto 4px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 8px' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Plus</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8,
          padding: '8px 16px 20px',
        }}>
          {items.map(({ href, label, icon }) => {
            const Icon = ICON_MAP[icon] ?? ChartBar
            return (
              <button
                key={href}
                onClick={() => navigate(href)}
                style={{
                  background: 'var(--synapse-cream-50, #faf8f5)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px 8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ position: 'relative' }}>
                  <Icon size={22} style={{ color: 'var(--accent-brand)' }} />
                  {!!navCounts[href] && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -4,
                        right: -8,
                        minWidth: 16,
                        height: 16,
                        padding: '0 4px',
                        borderRadius: 8,
                        background: '#dc2626',
                        color: '#fff',
                        fontSize: 9,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {navCounts[href] > 9 ? '9+' : navCounts[href]}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.2 }}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

export function EmployeeMobileShell({ fullName, role, navItems, initialNotifications, initialUnreadCount, children }: Props) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(() => pathname.startsWith('/admin'))
  const feed = useNotificationsFeed(initialNotifications, initialUnreadCount)
  const navCounts = countUnreadByHref(feed.notifications)

  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

  const visibleItems = navItems.filter((item) => !item.hidden)
  const employeeSection = visibleItems.filter((item) => item.group === 'employee')
  const adminSection = visibleItems.filter((item) => item.group === 'admin')
  const mobileNav = visibleItems.slice(0, 4)
  const moreItems = visibleItems.slice(4)
  const moreActive = moreItems.some((item) => pathname === item.href || pathname.startsWith(item.href + '/'))

  return (
    <>
      <RoutePrefetcher routes={visibleItems.map((item) => item.href)} />
      {/* ── Desktop layout (md+) ── */}
      <div className="hidden md:flex min-h-screen">
        <aside
          className="w-60 flex flex-col shrink-0"
          style={{ backgroundColor: 'var(--sidebar)' }}
        >
          <div className="px-5 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--sidebar-border)' }}>
            <div>
              <p
                className="text-lg font-bold tracking-tight"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--sidebar-foreground)' }}
              >
                Synapse
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--sidebar-muted)' }}>
                {role === 'admin' ? 'Administrateur' : 'Employé'}
              </p>
            </div>
            <NotificationBell
              notifications={feed.notifications}
              unreadCount={feed.unreadCount}
              onMarkRead={feed.markRead}
              onMarkAllRead={feed.markAllRead}
              onClear={feed.clear}
              onClearAll={feed.clearAll}
            />
          </div>

          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {role === 'admin' ? (
              <>
                <p className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--sidebar-muted)' }}>
                  Employé
                </p>
                {employeeSection.map(({ href, label, icon }) => (
                  <SidebarNavLink key={href} href={href} label={label} icon={icon} count={navCounts[href]} />
                ))}
                <button
                  onClick={() => setAdminOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-2 pt-4 pb-1 cursor-pointer"
                  style={{ background: 'none', border: 'none' }}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--sidebar-muted)' }}>
                    Administration
                  </span>
                  <CaretDown
                    size={12}
                    weight="bold"
                    style={{ color: 'var(--sidebar-muted)', transform: adminOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s ease' }}
                  />
                </button>
                {adminOpen && adminSection.map(({ href, label, icon }) => (
                  <SidebarNavLink key={href} href={href} label={label} icon={icon} count={navCounts[href]} />
                ))}
              </>
            ) : (
              employeeSection.map(({ href, label, icon }) => (
                <SidebarNavLink key={href} href={href} label={label} icon={icon} count={navCounts[href]} />
              ))
            )}
          </nav>

          <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--sidebar-border)' }}>
            <p className="text-xs font-medium truncate" style={{ color: 'var(--sidebar-foreground)' }}>
              {fullName}
            </p>
            <form action={signOutAction} className="mt-2">
              <button
                type="submit"
                className="flex items-center gap-1.5 text-xs cursor-pointer transition-colors duration-150"
                style={{ color: 'var(--sidebar-muted)' }}
              >
                Déconnexion
              </button>
            </form>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--background)', padding: '28px 32px' }}>
          {children}
        </main>
      </div>

      {/* ── Mobile layout (< md) ── */}
      <div className="flex md:hidden flex-col min-h-screen max-w-[480px] mx-auto" style={{ background: 'var(--bg-base)' }}>
        <header
          className="flex items-center justify-between px-4 sticky top-0 z-20 flex-shrink-0"
          style={{
            height: 52,
            background: 'white',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <Image
              src="/logos/synapse-logo-nobg.png"
              alt="Synapse"
              width={28}
              height={28}
              style={{ height: 28, width: 'auto', objectFit: 'contain' }}
              priority
            />
            <div style={{ width: 1, height: 18, background: 'var(--border-default)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              {role === 'admin' ? 'Admin' : 'Employé'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell
              notifications={feed.notifications}
              unreadCount={feed.unreadCount}
              onMarkRead={feed.markRead}
              onMarkAllRead={feed.markAllRead}
              onClear={feed.clear}
              onClearAll={feed.clearAll}
            />
            <span
              className="hidden xs:flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--synapse-green-50)', color: 'var(--synapse-green-500)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              Ouvert
            </span>
            <form action={signOutAction}>
              <button
                type="submit"
                title={`${fullName} — Déconnexion`}
                className="flex items-center justify-center rounded-full text-white text-xs font-bold transition-opacity hover:opacity-80 cursor-pointer"
                style={{ width: 32, height: 32, background: 'var(--accent-brand)', flexShrink: 0 }}
              >
                {initials}
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 80 }}>
          {children}
        </main>

        <nav
          className="fixed bottom-0 left-1/2 -translate-x-1/2 flex items-stretch z-20"
          style={{
            width: '100%',
            maxWidth: 480,
            height: 64,
            background: 'white',
            borderTop: '1px solid var(--border-subtle)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {mobileNav.map(({ href, label, icon }) => {
            const Icon = ICON_MAP[icon] ?? ChartBar
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center justify-center gap-[3px] transition-colors duration-150"
                style={{
                  color: active ? 'var(--accent-brand)' : 'var(--muted-foreground)',
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                }}
              >
                <div style={{ position: 'relative' }}>
                  <Icon size={20} weight={active ? 'bold' : 'regular'} />
                  {!!navCounts[href] && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -4,
                        right: -8,
                        minWidth: 16,
                        height: 16,
                        padding: '0 4px',
                        borderRadius: 8,
                        background: '#dc2626',
                        color: '#fff',
                        fontSize: 9,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {navCounts[href] > 9 ? '9+' : navCounts[href]}
                    </span>
                  )}
                </div>
                <span>{label}</span>
              </Link>
            )
          })}

          {moreItems.length > 0 && (
            <button
              onClick={() => setMoreOpen(true)}
              className="flex-1 flex flex-col items-center justify-center gap-[3px] transition-colors duration-150"
              style={{
                color: moreActive ? 'var(--accent-brand)' : 'var(--muted-foreground)',
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: '0.02em',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <DotsThree size={20} weight={moreActive ? 'bold' : 'regular'} />
              <span>Plus</span>
            </button>
          )}
        </nav>

        <MoreDrawer open={moreOpen} onClose={() => setMoreOpen(false)} items={moreItems} navCounts={navCounts} />
      </div>
    </>
  )
}
