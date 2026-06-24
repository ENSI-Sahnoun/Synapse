import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { signOutAction } from '@/data/auth/sign-out'

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

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-sidebar flex flex-col">
        <div className="p-4 border-b">
          <h1 className="font-semibold text-sm">Synapse</h1>
          <p className="text-xs text-muted-foreground">Administration</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 text-sm">
          <Link href="/admin/dashboard" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent">
            Tableau de bord
          </Link>
          <Link href="/admin/students" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent">
            Étudiants
          </Link>
          <Link href="/admin/employees" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent">
            Employés
          </Link>
          <Link href="/admin/subscription-plans" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent">
            Formules
          </Link>
        </nav>
        <div className="p-4 border-t text-xs text-muted-foreground">
          <p>{profile.full_name}</p>
          <form action={signOutAction}>
            <button type="submit" className="text-destructive mt-1">Déconnexion</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
