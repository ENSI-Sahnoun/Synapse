'use server'

import { adminActionClient } from '@/lib/safe-action'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { createSupabaseClient } from '@/supabase-clients/server'
import { updateStudentSchema } from '@/utils/zod-schemas/student'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const userIdSchema = z.object({ id: z.string().uuid() })

export const updateStudentAction = adminActionClient
  .schema(updateStudentSchema)
  .action(async ({ parsedInput }) => {
    const { id, email: _email, ...updates } = parsedInput
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/students')
    revalidatePath(`/admin/students/${id}`)
    return { success: true }
  })

export const archiveUserAction = adminActionClient
  .schema(userIdSchema)
  .action(async ({ parsedInput }) => {
    const { id } = parsedInput
    const adminSupabase = createSupabaseAdminClient()

    const { error: banError } = await adminSupabase.auth.admin.updateUserById(id, {
      ban_duration: '87600h',
    })
    if (banError) throw new Error(`Erreur désactivation: ${banError.message}`)

    const { error: profileError } = await adminSupabase
      .from('profiles')
      .update({ is_archived: true })
      .eq('id', id)
    if (profileError) throw new Error(`Erreur profil: ${profileError.message}`)

    revalidatePath('/admin/students')
    revalidatePath('/admin/employees')
    return { success: true }
  })

export const restoreUserAction = adminActionClient
  .schema(userIdSchema)
  .action(async ({ parsedInput }) => {
    const { id } = parsedInput
    const adminSupabase = createSupabaseAdminClient()

    const { error: unbanError } = await adminSupabase.auth.admin.updateUserById(id, {
      ban_duration: 'none',
    })
    if (unbanError) throw new Error(`Erreur restauration: ${unbanError.message}`)

    const { error: profileError } = await adminSupabase
      .from('profiles')
      .update({ is_archived: false })
      .eq('id', id)
    if (profileError) throw new Error(`Erreur profil: ${profileError.message}`)

    revalidatePath('/admin/students')
    revalidatePath('/admin/employees')
    return { success: true }
  })

export const hardDeleteUserAction = adminActionClient
  .schema(userIdSchema)
  .action(async ({ parsedInput }) => {
    const { id } = parsedInput
    const adminSupabase = createSupabaseAdminClient()

    const { error } = await adminSupabase.auth.admin.deleteUser(id)
    if (error) throw new Error(`Erreur suppression: ${error.message}`)

    revalidatePath('/admin/students')
    revalidatePath('/admin/employees')
    return { success: true }
  })
