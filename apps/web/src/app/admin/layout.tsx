import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { signOutAction } from '@/data/auth/sign-out'
import { SidebarNavLink } from '@/components/ui/sidebar-nav-link'
import {
  ChartBar,
  Users,
  UserCircle,
  CreditCard,
  SignOut,
} from '@phosphor-icons/react/dist/ssr'

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

  const navItems = [
    { href: '/admin/dashboard', label: 'Tableau de bord', Icon: ChartBar },
    { href: '/admin/students', label: 'Étudiants', Icon: Users },
    { href: '/admin/employees', label: 'Employés', Icon: UserCircle },
    { href: '/admin/subscription-plans', label: 'Formules', Icon: CreditCard },
  ]

  return (
    <div className="flex min-h-screen">
      <aside
        className="w-60 flex flex-col shrink-0"
        style={{ backgroundColor: 'var(--sidebar)' }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
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

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, Icon }) => (
            <SidebarNavLink key={href} href={href} label={label} Icon={Icon} />
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
              className="flex items-center gap-1.5 text-xs cursor-pointer transition-colors duration-150"
              style={{ color: 'var(--sidebar-muted)' }}
            >
              <SignOut size={14} />
              Déconnexion
            </button>
          </form>
        </div>

      </aside>

      <main className="flex-1 p-6" style={{ backgroundColor: 'var(--background)' }}>
        {children}
      </main>
    </div>
  )
}
