'use server'

import { adminActionClient } from '@/lib/safe-action'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { createSupabaseClient } from '@/supabase-clients/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const createEmployeeSchema = z.object({
  full_name: z.string().min(2, 'Nom requis'),
  email: z.string().email('Email invalide'),
  phone: z.string().optional(),
})

export const createEmployeeAction = adminActionClient
  .schema(createEmployeeSchema)
  .action(async ({ parsedInput }) => {
    const { full_name, email, phone } = parsedInput
    const adminSupabase = createSupabaseAdminClient()

    const tempPassword = Math.random().toString(36).slice(-12) + 'E1!'

    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password: tempPassword,
      user_metadata: { full_name, phone },
      email_confirm: true,
    })

    if (authError) throw new Error(`Erreur: ${authError.message}`)

    // Elevate role from 'student' (trigger default) to 'employee'
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .update({ role: 'employee', full_name, phone })
      .eq('id', authData.user.id)

    if (profileError) throw new Error(`Erreur profil: ${profileError.message}`)

    revalidatePath('/admin/employees')
    return { employeeId: authData.user.id }
  })

const updateEmployeeSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(2, 'Nom requis').optional(),
  phone: z.string().optional(),
})

export const updateEmployeeAction = adminActionClient
  .schema(updateEmployeeSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...updates } = parsedInput
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/employees')
    revalidatePath(`/admin/employees/${id}/edit`)
    return { success: true }
  })
