import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { signOutAction } from '@/data/auth/sign-out'
import { SidebarNavLink } from '@/components/ui/sidebar-nav-link'
import { SignOut } from '@phosphor-icons/react/dist/ssr'
import { getMyNotifications, getMyUnreadCount } from '@/data/notifications/list'
import { NotificationBell } from '@/components/notifications/NotificationBell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/login')

  let notifications: Awaited<ReturnType<typeof getMyNotifications>> = []
  let unreadCount = 0
  try {
    ;[notifications, unreadCount] = await Promise.all([getMyNotifications(20), getMyUnreadCount()])
  } catch {
    // non-fatal — bell renders empty
  }

  const navItems = [
    { href: '/admin/dashboard', label: 'Tableau de bord', icon: 'ChartBar' },
    { href: '/admin/students', label: 'Étudiants', icon: 'Users' },
    { href: '/admin/employees', label: 'Employés', icon: 'UserCircle' },
    { href: '/admin/subscription-plans', label: 'Formules', icon: 'CreditCard' },
    { href: '/admin/rooms', label: 'Salles', icon: 'Buildings' },
    { href: '/admin/checkin', label: 'Contrôle accès', icon: 'QrCode' },
    { href: '/admin/loyalty', label: 'Fidélité', icon: 'Star' },
    { href: '/admin/settings', label: 'Paramètres', icon: 'Gear' },
  ]

  return (
    <div className="flex min-h-screen">
      <aside
        className="w-60 flex flex-col shrink-0"
        style={{ backgroundColor: 'var(--sidebar)' }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--sidebar-border)' }}>
          <div>
            <p
              className="text-lg tracking-tight"
              style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--sidebar-foreground)' }}
            >
              Synapse
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--sidebar-muted)' }}>
              Administration
            </p>
          </div>
          <NotificationBell initialNotifications={notifications} initialUnreadCount={unreadCount} />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon }) => (
            <SidebarNavLink key={href} href={href} label={label} icon={icon} />
          ))}
        </nav>

        {/* User footer */}
        <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--sidebar-border)' }}>
          <p className="text-xs font-medium truncate" style={{ color: 'var(--sidebar-foreground)' }}>
            {profile.full_name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--sidebar-muted)' }}>
            Administrateur
          </p>
          <form action={signOutAction} className="mt-2">
            <button
              type="submit"
              className="flex items-center gap-1.5 text-xs cursor-pointer transition-colors duration-150 signout-btn"
              style={{ color: 'var(--sidebar-muted)' }}
            >
              <SignOut size={14} />
              Déconnexion
            </button>
          </form>
        </div>

        <style>{`.signout-btn:hover { color: var(--destructive) !important; }`}</style>
      </aside>

      <main className="flex-1 p-6" style={{ backgroundColor: 'var(--background)' }}>
        {children}
      </main>
    </div>
  )
}
