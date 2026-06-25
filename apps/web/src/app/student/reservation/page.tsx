import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { ReservationSeatMap } from './ReservationSeatMap'
import { ActiveReservationBanner } from './ActiveReservationBanner'

export const dynamic = 'force-dynamic'

export default async function ReservationPage() {
  const supabase = await createSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check active subscription
  const today = new Date().toISOString().split('T')[0]
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('end_date')
    .eq('student_id', user.id)
    .gte('end_date', today)
    .limit(1)
    .maybeSingle()

  // Check existing active reservation
  const { data: activeReservation } = await supabase
    .from('reservations')
    .select('id, seat_id, expires_at, seats(label)')
    .eq('student_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  // Fetch rooms + tables + seats for map
  const { data: rooms } = await supabase
    .from('rooms')
    .select(
      'id, name, status, status_note, tables(id, position_x, position_y, width, height, rotation, label), seats(id, label, position_x, position_y, rotation, status, table_id)',
    )
    .eq('status', 'open')

  const typedReservation = activeReservation as {
    id: string
    seat_id: string
    expires_at: string
    seats: { label: string } | null
  } | null

  return (
    <div className="flex flex-col gap-4 p-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold">Réserver une place</h1>

      {!subscription && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
          Vous devez avoir un abonnement actif pour réserver une place.
        </div>
      )}

      {typedReservation && <ActiveReservationBanner reservation={typedReservation} />}

      {subscription && !typedReservation && <ReservationSeatMap rooms={rooms ?? []} />}
    </div>
  )
}
