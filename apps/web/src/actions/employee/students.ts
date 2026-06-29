'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { createSupabaseClient } from '@/supabase-clients/server'
import { createStudentSchema } from '@/utils/zod-schemas/student'
import { revalidatePath } from 'next/cache'
import { assignQrToken } from '@/actions/student/assign-qr-token'
import { z } from 'zod'

export const createStudentAction = employeeActionClient
  .schema(createStudentSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { full_name, phone, email, university, study_level } = parsedInput
    const adminSupabase = createSupabaseAdminClient()

    // Generate a temporary password — student will reset via email
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'

    // Create auth user (triggers handle_new_user → creates profile with role='student')
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: email || `${phone}@synapse.local`,
      password: tempPassword,
      user_metadata: { full_name, phone, university, study_level },
      email_confirm: true, // skip email confirmation for admin-created accounts
    })

    if (authError) throw new Error(`Erreur création compte: ${authError.message}`)

    const userId = authData.user.id

    // Update profile with complete details (trigger may have set partial data)
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .update({ full_name, phone, university, study_level })
      .eq('id', userId)

    if (profileError) throw new Error(`Erreur profil: ${profileError.message}`)

    // Assign HMAC QR token after profile is set up
    await assignQrToken(userId)

    revalidatePath('/employee/students')
    revalidatePath('/admin/students')

    return { studentId: userId }
  })

export const getStudentDetailAction = employeeActionClient
  .schema(z.object({ studentId: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    const { studentId } = parsedInput
    const supabase = await createSupabaseClient()

    const [subResult, pointsResult, visitsResult] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('end_date, subscription_plans(name)')
        .eq('student_id', studentId)
        .gte('end_date', new Date().toISOString().split('T')[0])
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('loyalty_ledger')
        .select('points_delta')
        .eq('student_id', studentId),
      supabase
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', studentId),
    ])

    const sub = subResult.data
    const points = (pointsResult.data ?? []).reduce((s, r) => s + (r.points_delta ?? 0), 0)
    const visits = visitsResult.count ?? 0

    return {
      planName: (sub?.subscription_plans as { name: string } | null)?.name ?? null,
      endDate: sub?.end_date ?? null,
      loyaltyPoints: points,
      totalVisits: visits,
    }
  })
