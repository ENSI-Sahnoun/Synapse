'use server'

import { adminActionClient, employeeActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import {
  createRoomSchema,
  updateRoomSchema,
  setRoomStatusSchema,
  deleteRoomSchema,
} from '@/utils/zod-schemas/room'
import { revalidatePath } from 'next/cache'

export const createRoomAction = adminActionClient
  .schema(createRoomSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { data, error } = await supabase
      .from('rooms')
      .insert({ name: parsedInput.name, capacity: parsedInput.capacity, status: 'open' })
      .select()
      .single()

    if (error) throw new Error(error.message)

    revalidatePath('/admin/rooms')
    return { room: data }
  })

export const updateRoomAction = adminActionClient
  .schema(updateRoomSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const updates: Record<string, unknown> = {}
    if (parsedInput.name !== undefined) updates.name = parsedInput.name
    if (parsedInput.capacity !== undefined) updates.capacity = parsedInput.capacity

    const { data, error } = await supabase
      .from('rooms')
      .update(updates)
      .eq('id', parsedInput.id)
      .select()
      .single()

    if (error) throw new Error(error.message)

    revalidatePath('/admin/rooms')
    revalidatePath(`/admin/rooms/${parsedInput.id}/editor`)
    return { room: data }
  })

export const setRoomStatusAction = employeeActionClient
  .schema(setRoomStatusSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { data, error } = await supabase
      .from('rooms')
      .update({ status: parsedInput.status, status_note: parsedInput.status_note ?? null })
      .eq('id', parsedInput.id)
      .select()
      .single()

    if (error) throw new Error(error.message)

    revalidatePath('/admin/rooms')
    revalidatePath('/employee/rooms')
    return { room: data }
  })

export const deleteRoomAction = adminActionClient
  .schema(deleteRoomSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase.from('rooms').delete().eq('id', parsedInput.id)

    if (error) throw new Error(error.message)

    revalidatePath('/admin/rooms')
    return { deleted: true }
  })
