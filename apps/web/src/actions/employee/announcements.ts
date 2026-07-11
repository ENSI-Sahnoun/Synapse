'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { notifyAllUsers } from '@/data/notifications/inapp'

const announcementSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  pinned: z.boolean().default(false),
  important: z.boolean().default(false),
  recipientId: z.string().uuid().optional(),
})

export const createAnnouncementAction = employeeActionClient
  .schema(announcementSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { important, recipientId, ...record } = parsedInput
    const supabase = await createSupabaseClient()
    const { data: inserted, error } = await (supabase.from('announcements' as never) as any)
      .insert({ ...record, recipient_id: recipientId ?? null, created_by: ctx.userId })
      .select('id')
      .single()
    if (error) throw new Error('Erreur lors de la publication')
    await notifyAllUsers('announcement_new', `${parsedInput.title}: ${parsedInput.body}`, {
      important,
      onlyUserId: recipientId,
      announcementId: inserted.id,
    })
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
