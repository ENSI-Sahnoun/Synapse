import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { getCachedLoggedInUserIdOrNull } from '@/rsc-data/supabase'
import { ReservationSeatMap } from './ReservationSeatMap'
import { ActiveReservationBanner } from './ActiveReservationBanner'
import { getMyPresence } from '@/data/student/profile'

export const dynamic = 'force-dynamic'

export default async function ReservationPage() {
  const supabase = await createSupabaseClient()

  const userId = await getCachedLoggedInUserIdOrNull()
  if (!userId) redirect('/login')

  // Check active subscription
  const today = new Date().toISOString().split('T')[0]
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('end_date')
    .eq('student_id', userId)
    .gte('end_date', today)
    .limit(1)
    .maybeSingle()

  // Check existing active reservation
  const { data: activeReservation } = await supabase
    .from('reservations')
    .select('id, seat_id, expires_at, queue_position, seats(label)')
    .eq('student_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  // Fetch exam_mode setting
  const { data: examModeSetting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'exam_mode')
    .maybeSingle()

  const examMode = examModeSetting?.value === 'true'

  // Fetch every room (open/closed/reserved) — closed/reserved ones are still shown
  // to students, just non-interactive (LiveSeatMap handles that per its `mode` prop).
  const { data: rooms } = await supabase
    .from('rooms')
    .select(
      'id, name, status, status_note, tables(id, room_id, position_x, position_y, width, height, rotation, label, status, created_at), seats(id, label, position_x, position_y, rotation, status, table_id, room_id)',
    )

  const presence = await getMyPresence()
  const mySeatId = presence.status === 'seated' ? presence.seatId : null
  const alreadyCheckedIn = presence.status === 'seated' || presence.status === 'divers'

  const typedReservation = activeReservation as {
    id: string
    seat_id: string
    expires_at: string
    queue_position: number | null
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

      {typedReservation && <ActiveReservationBanner reservation={typedReservation} examMode={examMode} />}

      {subscription && !typedReservation && examMode && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-blue-800 text-sm">
          <strong>Mode examen activé</strong> — une réservation est obligatoire pour accéder à l'espace.
          Choisissez une place ci-dessous.
        </div>
      )}

      {subscription && !typedReservation && (
        <ReservationSeatMap rooms={rooms ?? []} mySeatId={mySeatId} alreadyCheckedIn={alreadyCheckedIn} />
      )}
    </div>
  )
}
