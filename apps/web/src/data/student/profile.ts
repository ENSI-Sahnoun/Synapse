'use server'

import { createSupabaseClient } from '@/supabase-clients/server'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { getCachedLoggedInUserId, getCachedLoggedInUserIdOrNull } from '@/rsc-data/supabase'

export async function getMyProfile() {
  const supabase = await createSupabaseClient()
  const userId = await getCachedLoggedInUserId()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, university, study_level, qr_token, student_number, created_at')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

export async function getMyActiveSubscription() {
  const supabase = await createSupabaseClient()
  const userId = await getCachedLoggedInUserIdOrNull()
  if (!userId) return null

  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('subscriptions')
    .select(`
      id, start_date, end_date, paid_amount,
      subscription_plans ( name, duration_days )
    `)
    .eq('student_id', userId)
    .gte('end_date', today)
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

export async function getMyCheckInHistory(limit = 500) {
  const supabase = await createSupabaseClient()
  const userId = await getCachedLoggedInUserId()

  // attendance.room_id has no FK yet — fetch room names in a separate lookup
  const { data, error } = await supabase
    .from('attendance')
    .select('id, checked_in_at, checked_out_at, room_id')
    .eq('student_id', userId)
    .order('checked_in_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  const rows = data ?? []

  // Resolve room names
  const roomIds = [...new Set(rows.map((r) => r.room_id).filter(Boolean))] as string[]
  let roomMap: Record<string, string> = {}
  if (roomIds.length > 0) {
    const { data: rooms } = await supabase
      .from('rooms')
      .select('id, name')
      .in('id', roomIds)
    roomMap = Object.fromEntries((rooms ?? []).map((r) => [r.id, r.name]))
  }

  return rows.map((r) => ({
    ...r,
    roomName: r.room_id ? (roomMap[r.room_id] ?? 'Salle Inconnue') : 'Divers',
  }))
}

export async function getMyCheckInCounts() {
  const supabase = await createSupabaseClient()
  const userId = await getCachedLoggedInUserId()

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('attendance')
    .select('checked_in_at')
    .eq('student_id', userId)

  const rows = data ?? []
  // Multiple check-ins the same day (left and came back) still count as one visit
  const uniqueDay = (r: { checked_in_at: string }) => r.checked_in_at.slice(0, 10)
  const total = new Set(rows.map(uniqueDay)).size
  const thisMonth = new Set(
    rows.filter((r) => new Date(r.checked_in_at) >= monthStart).map(uniqueDay)
  ).size

  return { total, thisMonth }
}

export type MyPresence =
  | { status: 'seated'; attendanceId: string; seatId: string; roomId: string | null; label: string; room: string | null }
  | { status: 'divers'; attendanceId: string }
  | { status: 'absent' }

export async function getMyPresence(): Promise<MyPresence> {
  const supabase = await createSupabaseClient()
  const userId = await getCachedLoggedInUserIdOrNull()
  if (!userId) return { status: 'absent' }

  // attendance.seat_id has no FK constraint, so PostgREST can't embed
  // seats(...)/rooms(...) here — resolve them with separate lookups instead.
  const { data } = await supabase
    .from('attendance')
    .select('id, seat_id')
    .eq('student_id', userId)
    .is('checked_out_at', null)
    .order('checked_in_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return { status: 'absent' }
  if (!data.seat_id) return { status: 'divers', attendanceId: data.id }

  const admin = createSupabaseAdminClient()
  const { data: seat } = await admin
    .from('seats')
    .select('label, room_id')
    .eq('id', data.seat_id)
    .maybeSingle()

  if (!seat) return { status: 'divers', attendanceId: data.id }

  let roomName: string | null = null
  if (seat.room_id) {
    const { data: room } = await admin.from('rooms').select('name').eq('id', seat.room_id).maybeSingle()
    roomName = room?.name ?? null
  }

  return { status: 'seated', attendanceId: data.id, seatId: data.seat_id, roomId: seat.room_id, label: seat.label, room: roomName }
}

export async function getMyLoyaltyBalance() {
  const supabase = await createSupabaseClient()
  const userId = await getCachedLoggedInUserIdOrNull()
  if (!userId) return 0

  const { data } = await supabase
    .from('loyalty_ledger')
    .select('points_delta')
    .eq('student_id', userId)

  return data?.reduce((sum, row) => sum + row.points_delta, 0) ?? 0
}
