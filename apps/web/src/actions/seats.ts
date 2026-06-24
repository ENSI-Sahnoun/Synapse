'use server'

import { adminActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { upsertSeatsSchema, deleteSeatSchema } from '@/utils/zod-schemas/seat'
import { revalidatePath } from 'next/cache'

export const upsertSeatsAction = adminActionClient
  .schema(upsertSeatsSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()

    const rows = parsedInput.seats.map((s) => ({
      ...(s.id ? { id: s.id } : {}),
      room_id: s.room_id,
      label: s.label,
      position_x: s.position_x,
      position_y: s.position_y,
      status: s.status,
    }))

    const { data, error } = await supabase
      .from('seats')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: false })
      .select()

    if (error) throw new Error(error.message)

    revalidatePath(`/admin/rooms/${parsedInput.room_id}/editor`)
    revalidatePath(`/admin/rooms/${parsedInput.room_id}/map`)
    revalidatePath(`/employee/rooms/${parsedInput.room_id}/map`)
    return { seats: data }
  })

export const deleteSeatAction = adminActionClient
  .schema(deleteSeatSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('seats')
      .delete()
      .eq('id', parsedInput.id)
      .eq('room_id', parsedInput.room_id)

    if (error) throw new Error(error.message)

    revalidatePath(`/admin/rooms/${parsedInput.room_id}/editor`)
    revalidatePath(`/employee/rooms/${parsedInput.room_id}/map`)
    return { deleted: true }
  })
