'use server'

import { adminActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { upsertSeatMapSchema, deleteTableSchema } from '@/utils/zod-schemas/table'
import { deleteSeatSchema } from '@/utils/zod-schemas/seat'
import { revalidatePath } from 'next/cache'

// Batch save: upsert tables first, then seats (tables must exist before seats reference them)
export const upsertSeatMapAction = adminActionClient
  .schema(upsertSeatMapSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { room_id, tables, seats } = parsedInput

    if (tables.length > 0) {
      const { error: tableError } = await supabase
        .from('tables')
        .upsert(
          tables.map((t) => ({
            id: t.id,
            room_id: t.room_id,
            label: t.label,
            position_x: t.position_x,
            position_y: t.position_y,
            width: t.width,
            height: t.height,
            rotation: t.rotation,
          })),
          { onConflict: 'id', ignoreDuplicates: false },
        )
      if (tableError) throw new Error(tableError.message)
    }

    if (seats.length > 0) {
      const { error: seatError } = await supabase
        .from('seats')
        .upsert(
          seats.map((s) => ({
            ...(s.id ? { id: s.id } : {}),
            room_id: s.room_id,
            table_id: s.table_id,
            label: s.label,
            position_x: s.position_x,
            position_y: s.position_y,
            rotation: s.rotation,
            status: s.status,
          })),
          { onConflict: 'id', ignoreDuplicates: false },
        )
      if (seatError) throw new Error(seatError.message)
    }

    revalidatePath(`/admin/rooms/${room_id}/editor`)
    revalidatePath(`/employee/rooms/${room_id}/map`)
    return { ok: true }
  })

export const deleteTableAction = adminActionClient
  .schema(deleteTableSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    // ON DELETE SET NULL cascade handles unlinking seats automatically
    const { error } = await supabase
      .from('tables')
      .delete()
      .eq('id', parsedInput.id)
      .eq('room_id', parsedInput.room_id)

    if (error) throw new Error(error.message)

    revalidatePath(`/admin/rooms/${parsedInput.room_id}/editor`)
    revalidatePath(`/employee/rooms/${parsedInput.room_id}/map`)
    return { deleted: true }
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
