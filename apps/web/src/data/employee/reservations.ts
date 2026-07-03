import { createSupabaseClient } from '@/supabase-clients/server'

export type ActiveReservation = {
  id: string
  student_id: string
  seat_id: string
  status: string
  expires_at: string
  reserved_at: string
  queue_position: number | null
  is_priority: boolean
  student_name: string
  seat_label: string
  room_name: string
}

export async function getActiveReservations(): Promise<ActiveReservation[]> {
  const supabase = await createSupabaseClient()

  const { data, error } = await supabase
    .from('reservations')
    .select(`
      id, student_id, seat_id, status, expires_at, reserved_at, queue_position, is_priority,
      profiles!reservations_student_id_fkey(full_name),
      seats!reservations_seat_id_fkey(label, rooms(name))
    `)
    .eq('status', 'active')
    .order('reserved_at', { ascending: true })

  if (error || !data) return []

  return data.map((r) => {
    const profile = r.profiles as { full_name: string } | null
    const seat = r.seats as { label: string; rooms: { name: string } | null } | null
    return {
      id: r.id,
      student_id: r.student_id,
      seat_id: r.seat_id,
      status: r.status,
      expires_at: r.expires_at,
      reserved_at: r.reserved_at,
      queue_position: r.queue_position,
      is_priority: r.is_priority,
      student_name: profile?.full_name ?? 'Inconnu',
      seat_label: seat?.label ?? '—',
      room_name: seat?.rooms?.name ?? '—',
    }
  })
}
