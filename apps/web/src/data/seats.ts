import { createSupabaseClient } from '@/supabase-clients/server'
import type { Database } from '@/lib/database.types'

export type Seat = Database['public']['Tables']['seats']['Row']

export async function getSeatsByRoom(roomId: string): Promise<Seat[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('seats')
    .select('*')
    .eq('room_id', roomId)
    .order('label')

  if (error) throw new Error(error.message)
  return data
}
