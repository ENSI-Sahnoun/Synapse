import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Synapse — Kiosque',
}

export default async function KioskLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/kiosk/setup')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'employee'].includes(profile.role)) {
    redirect('/kiosk/setup')
  }

  return (
    <div
      className="text-white w-screen h-screen overflow-hidden fixed inset-0"
      style={{ backgroundColor: 'var(--sidebar)' }}
    >
      {children}
    </div>
  )
}
