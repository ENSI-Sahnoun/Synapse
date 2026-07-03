import { createSupabaseClient } from '@/supabase-clients/server'

export interface PendingSwapRequest {
  id: string
  studentName: string
  fromLabel: string | null
  fromRoom: string | null
  toLabel: string
  toRoom: string | null
  createdAt: string
}

export async function getPendingSwapRequests(): Promise<PendingSwapRequest[]> {
  const supabase = await createSupabaseClient()

  const { data: requests } = await supabase
    .from('seat_swap_requests')
    .select('id, student_id, from_seat_id, to_seat_id, created_at, profiles!seat_swap_requests_student_id_fkey(full_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const rows = requests ?? []
  if (rows.length === 0) return []

  const seatIds = [...new Set([...rows.map((r) => r.from_seat_id), ...rows.map((r) => r.to_seat_id)].filter(Boolean))] as string[]
  const { data: seats } = await supabase.from('seats').select('id, label, room_id').in('id', seatIds)
  const seatMap = Object.fromEntries((seats ?? []).map((s) => [s.id, s]))

  const roomIds = [...new Set((seats ?? []).map((s) => s.room_id).filter(Boolean))] as string[]
  const { data: rooms } = roomIds.length > 0
    ? await supabase.from('rooms').select('id, name').in('id', roomIds)
    : { data: [] }
  const roomMap = Object.fromEntries((rooms ?? []).map((r) => [r.id, r.name]))

  return rows.map((r) => {
    const fromSeat = r.from_seat_id ? seatMap[r.from_seat_id] : null
    const toSeat = seatMap[r.to_seat_id]
    return {
      id: r.id,
      studentName: (r.profiles as unknown as { full_name: string | null } | null)?.full_name ?? 'Inconnu',
      fromLabel: fromSeat?.label ?? null,
      fromRoom: fromSeat?.room_id ? (roomMap[fromSeat.room_id] ?? null) : null,
      toLabel: toSeat?.label ?? '—',
      toRoom: toSeat?.room_id ? (roomMap[toSeat.room_id] ?? null) : null,
      createdAt: r.created_at,
    }
  })
}
