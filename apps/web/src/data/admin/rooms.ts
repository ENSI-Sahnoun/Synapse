import { createSupabaseClient } from '@/supabase-clients/server'
import type { Database } from '@/lib/database.types'

export type Room = Database['public']['Tables']['rooms']['Row']
export type RoomWithSeatCount = Room & { seat_count: number; occupied_count: number }

export async function getRooms(): Promise<Room[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.from('rooms').select('*').order('name')
  if (error) throw new Error(error.message)
  return data
}

export async function getRoomById(id: string): Promise<Room | null> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.from('rooms').select('*').eq('id', id).single()
  if (error) return null
  return data
}

export async function getRoomsWithSeatCounts(): Promise<RoomWithSeatCount[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('rooms')
    .select('*, seats ( id, status )')
    .order('name')

  if (error || !data) {
    const rooms = await getRooms()
    return rooms.map((r) => ({ ...r, seat_count: 0, occupied_count: 0 }))
  }

  return (data as (Room & { seats: { id: string; status: string }[] })[]).map((room) => ({
    ...room,
    seat_count: room.seats.length,
    occupied_count: room.seats.filter((s) => s.status === 'occupied').length,
  }))
}
