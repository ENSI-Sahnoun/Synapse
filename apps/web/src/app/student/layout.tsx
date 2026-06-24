import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { signOutAction } from '@/data/auth/sign-out'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'student') redirect('/login')

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-sm">Synapse</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{profile.full_name}</span>
          <form action={signOutAction}>
            <button type="submit" className="text-xs text-destructive">Déconnexion</button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4 pb-20">{children}</main>
      {/* Bottom nav — mobile-first */}
      <nav className="fixed bottom-0 inset-x-0 border-t bg-background flex">
        <Link href="/student/dashboard" className="flex-1 flex flex-col items-center py-3 text-xs gap-1">
          Abonnement
        </Link>
        <Link href="/student/qr" className="flex-1 flex flex-col items-center py-3 text-xs gap-1">
          QR Code
        </Link>
        <Link href="/student/reservation" className="flex-1 flex flex-col items-center py-3 text-xs gap-1">
          Réserver
        </Link>
        <Link href="/student/loyalty" className="flex-1 flex flex-col items-center py-3 text-xs gap-1">
          Points
        </Link>
      </nav>
    </div>
  )
}
