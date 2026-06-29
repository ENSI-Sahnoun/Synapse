'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const announcementSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  pinned: z.boolean().default(false),
})

export const createAnnouncementAction = employeeActionClient
  .schema(announcementSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createSupabaseClient()
    const { error } = await (supabase.from('announcements' as never) as any)
      .insert({ ...parsedInput, created_by: ctx.userId })
    if (error) throw new Error('Erreur lors de la publication')
    revalidatePath('/employee/announcements')
    return { ok: true }
  })

export const deleteAnnouncementAction = employeeActionClient
  .schema(z.object({ id: z.string().uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createSupabaseClient()
    const { error } = await (supabase.from('announcements' as never) as any)
      .delete()
      .eq('id', parsedInput.id)
      .eq('created_by', ctx.userId)
    if (error) throw new Error('Erreur lors de la suppression')
    revalidatePath('/employee/announcements')
    return { ok: true }
  })
