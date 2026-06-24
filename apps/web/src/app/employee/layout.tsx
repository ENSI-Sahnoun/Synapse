import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { signOutAction } from '@/data/auth/sign-out'
import {
  ChartBar,
  Users,
  ShoppingCart,
  QrCode,
  SignOut,
} from '@phosphor-icons/react/dist/ssr'

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'employee'].includes(profile.role)) redirect('/login')

  const navItems = [
    { href: '/employee/dashboard', label: 'Tableau de bord', Icon: ChartBar },
    { href: '/employee/students', label: 'Étudiants', Icon: Users },
    { href: '/employee/pos', label: 'Caisse', Icon: ShoppingCart },
    { href: '/employee/checkin', label: 'Contrôle accès', Icon: QrCode },
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
            Accueil
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors duration-150 cursor-pointer"
              style={{ color: 'var(--sidebar-foreground)' }}
            >
              <Icon size={18} weight="regular" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--sidebar-border)' }}>
          <p className="text-xs font-medium truncate" style={{ color: 'var(--sidebar-foreground)' }}>
            {profile.full_name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--sidebar-muted)' }}>
            {profile.role === 'admin' ? 'Administrateur' : 'Employé'}
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

        <style>{`
          nav a:hover {
            background-color: var(--sidebar-accent);
          }
        `}</style>
      </aside>

      <main className="flex-1 p-6" style={{ backgroundColor: 'var(--background)' }}>
        {children}
      </main>
    </div>
  )
}
