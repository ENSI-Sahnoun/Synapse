'use server'

import { actionClient } from '@/lib/safe-action'
import { studentSignupSchema } from '@/utils/zod-schemas/auth'
import { createSupabaseClient } from '@/supabase-clients/server'

export const studentSignupAction = actionClient
  .schema(studentSignupSchema)
  .action(async ({ parsedInput }) => {
    const { full_name, email, phone, university, study_level, password } = parsedInput
    const supabase = await createSupabaseClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          phone: phone || null,
          university: university || null,
          study_level: study_level || null,
        },
      },
    })

    if (error) throw new Error(error.message)

    // handle_new_user trigger creates the profile automatically
    // role defaults to 'student'

    return {
      userId: data.user?.id,
      // If email confirmation is required, user won't be logged in yet
      needsEmailConfirmation: !data.session,
    }
  })
