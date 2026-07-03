'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  QrCode, ClipboardText, Users, ShoppingCart, DotsThree,
  ChartBar, Buildings, Gift, FileText, CalendarBlank,
  Megaphone, Export, UserCircle, X, Armchair, CaretDown,
} from '@phosphor-icons/react'
import { signOutAction } from '@/data/auth/sign-out'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { SidebarNavLink } from '@/components/ui/sidebar-nav-link'
import type { NotificationRow } from '@/data/notifications/list'
import Image from 'next/image'

const MOBILE_NAV = [
  { href: '/employee/checkin',    label: 'Scanner',    Icon: QrCode },
  { href: '/employee/attendance', label: 'Présences',  Icon: ClipboardText },
  { href: '/employee/students',   label: 'Lookup',     Icon: Users },
  { href: '/employee/pos',        label: 'Caisse',     Icon: ShoppingCart },
]

const MORE_ITEMS = [
  { href: '/employee/reservations',  label: 'Réservations',  Icon: Armchair },
  { href: '/employee/reports',       label: 'Rapports',     Icon: ChartBar },
  { href: '/employee/rooms',         label: 'Salles',        Icon: Buildings },
  { href: '/employee/shifts',        label: 'Mes horaires',  Icon: CalendarBlank },
  { href: '/employee/announcements', label: 'Annonces',      Icon: Megaphone },
  { href: '/employee/export',        label: 'Export',        Icon: Export },
  { href: '/employee/profile',       label: 'Mon profil',    Icon: UserCircle },
]

const EMPLOYEE_NAV = [
  { href: '/employee/dashboard',        label: 'Tableau de bord',  icon: 'ChartBar' },
  { href: '/employee/checkin',          label: 'Contrôle accès',   icon: 'QrCode' },
  { href: '/employee/attendance',       label: 'Présences',        icon: 'ClipboardText' },
  { href: '/employee/students',         label: 'Étudiants',        icon: 'Users' },
  { href: '/employee/rooms',            label: 'Salles',           icon: 'Buildings' },
  { href: '/employee/reservations',     label: 'Réservations',     icon: 'Armchair' },
  { href: '/employee/pos',              label: 'Caisse',           icon: 'ShoppingCart' },
  { href: '/employee/loyalty-requests', label: 'Récompenses',      icon: 'Gift' },
  { href: '/employee/reports',          label: 'Rapports',         icon: 'ChartBar' },
  { href: '/employee/announcements',    label: 'Annonces',         icon: 'Megaphone' },
  { href: '/employee/export',           label: 'Export',           icon: 'Export' },
  { href: '/employee/profile',          label: 'Mon profil',       icon: 'UserCircle' },
]

// Employees get a "Mes horaires" link; admins don't have shifts
const EMPLOYEE_NAV_FOR_EMPLOYEE = [
  ...EMPLOYEE_NAV.slice(0, 4),
  { href: '/employee/shifts', label: 'Mes horaires', icon: 'CalendarBlank' },
  ...EMPLOYEE_NAV.slice(4),
]

const ADMIN_DASHBOARD_ITEM = { href: '/admin/dashboard', label: 'Vue d\'ensemble', icon: 'ChartBar' }

const ADMIN_NAV = [
  { href: '/admin/students',               label: 'Gérer les étudiants', icon: 'Users' },
  { href: '/admin/employees',              label: 'Employés',       icon: 'UserCircle' },
  { href: '/admin/subscription-plans',     label: 'Formules',       icon: 'CreditCard' },
  { href: '/admin/rooms',                  label: 'Disposition salles', icon: 'Buildings' },
  { href: '/admin/products',               label: 'Produits (POS)', icon: 'ShoppingCart' },
  { href: '/admin/loyalty',                label: 'Fidélité',       icon: 'Star' },
  { href: '/admin/notifications/trigger',  label: 'Notifications',  icon: 'Bell' },
  { href: '/admin/settings',                label: 'Paramètres',     icon: 'Gear' },
]

interface Props {
  fullName: string
  role: string
  initialNotifications: NotificationRow[]
  initialUnreadCount: number
  children: React.ReactNode
}

function MoreDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          {MORE_ITEMS.map(({ href, label, Icon }) => (
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
              <Icon size={22} style={{ color: 'var(--accent-brand)' }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.2 }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

export function EmployeeMobileShell({ fullName, role, initialNotifications, initialUnreadCount, children }: Props) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(() => pathname.startsWith('/admin'))

  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

  const moreActive = MORE_ITEMS.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))

  return (
    <>
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
            <NotificationBell initialNotifications={initialNotifications} initialUnreadCount={initialUnreadCount} />
          </div>

          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {role === 'admin' ? (
              <>
                <p className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--sidebar-muted)' }}>
                  Employé
                </p>
                {[
                  ADMIN_DASHBOARD_ITEM,
                  // ponytail: hide these for admins for now, add back when needed
                  ...EMPLOYEE_NAV.slice(1).filter(
                    (item) => !['/employee/profile', '/employee/export', '/employee/reports'].includes(item.href),
                  ),
                ].map(({ href, label, icon }) => (
                  <SidebarNavLink key={href} href={href} label={label} icon={icon} />
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
                {adminOpen && ADMIN_NAV.map(({ href, label, icon }) => (
                  <SidebarNavLink key={href} href={href} label={label} icon={icon} />
                ))}
              </>
            ) : (
              EMPLOYEE_NAV_FOR_EMPLOYEE.map(({ href, label, icon }) => (
                <SidebarNavLink key={href} href={href} label={label} icon={icon} />
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
              src="/logos/logo.png"
              alt="Synapse"
              width={80}
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
            <NotificationBell initialNotifications={initialNotifications} initialUnreadCount={initialUnreadCount} />
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
          {MOBILE_NAV.map(({ href, label, Icon }) => {
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
                <Icon size={20} weight={active ? 'bold' : 'regular'} />
                <span>{label}</span>
              </Link>
            )
          })}

          {/* More tab */}
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
        </nav>

        <MoreDrawer open={moreOpen} onClose={() => setMoreOpen(false)} />
      </div>
    </>
  )
}
