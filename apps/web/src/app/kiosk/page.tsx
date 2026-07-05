import { redirect } from 'next/navigation'
import { createSupabaseClient } from '@/supabase-clients/server'
import { KioskClient, type KioskRoom } from './KioskClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Synapse — Kiosque',
}

export default async function KioskPage() {
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

  // Rooms + full seat plans for the post-scan seat picker. LiveSeatMap keeps
  // seat statuses live via realtime, so an initial load is enough.
  const { data: rooms } = await supabase
    .from('rooms')
    .select(
      'id, name, status, status_note, tables(*), seats(*)',
    )
    .order('name')

  return <KioskClient rooms={(rooms ?? []) as KioskRoom[]} />
}
