'use server'

import { actionClient } from '@/lib/safe-action'
import { studentSignupSchema } from '@/utils/zod-schemas/auth'
import { createSupabaseClient } from '@/supabase-clients/server'
import { assignQrToken } from '@/actions/student/assign-qr-token'

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

    if (error) {
      console.error('signUp error:', error.status, error.code, error.message)
      if (error.message.includes('already registered') || error.message.includes('User already registered')) {
        throw new Error('Un compte existe déjà avec cet email')
      }
      throw new Error('Erreur lors de la création du compte')
    }

    // handle_new_user trigger creates the profile automatically
    // role defaults to 'student'

    // Assign HMAC QR token — non-fatal: student can still log in, backfill recovers
    if (data.user) {
      try {
        await assignQrToken(data.user.id)
      } catch (e) {
        console.error('assignQrToken failed for', data.user.id, e)
      }
    }

    return {
      userId: data.user?.id,
      // If email confirmation is required, user won't be logged in yet
      needsEmailConfirmation: !data.session,
    }
  })
