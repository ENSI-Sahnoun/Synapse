import { createSupabaseClient } from '@/supabase-clients/server'
import type { Database } from '@/lib/database.types'

export type RoomTable = Database['public']['Tables']['tables']['Row']
export type Seat = Database['public']['Tables']['seats']['Row']

export async function getSeatMap(roomId: string): Promise<{ tables: RoomTable[]; seats: Seat[] }> {
  const supabase = await createSupabaseClient()

  const [{ data: tables, error: tablesError }, { data: seats, error: seatsError }] =
    await Promise.all([
      supabase
        .from('tables')
        .select('*')
        .eq('room_id', roomId)
        .neq('table_type', 'door')
        .order('created_at'),
      supabase.from('seats').select('*').eq('room_id', roomId).order('label'),
    ])

  if (tablesError) throw new Error(tablesError.message)
  if (seatsError) throw new Error(seatsError.message)

  return { tables: tables ?? [], seats: seats ?? [] }
}
