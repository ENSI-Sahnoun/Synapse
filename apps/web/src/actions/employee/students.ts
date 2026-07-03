'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { createSupabaseClient } from '@/supabase-clients/server'
import { createStudentSchema, updateStudentSchema } from '@/utils/zod-schemas/student'
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

    const { data: withToken } = await adminSupabase
      .from('profiles')
      .select('qr_token')
      .eq('id', userId)
      .single()

    revalidatePath('/employee/students')
    revalidatePath('/admin/students')

    return { studentId: userId, qrToken: withToken?.qr_token ?? null }
  })

export const getStudentDetailAction = employeeActionClient
  .schema(z.object({ studentId: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    const { studentId } = parsedInput
    const supabase = await createSupabaseClient()

    const [subResult, historyResult, pointsResult, visitsResult, profileResult] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('end_date, subscription_plans(name)')
        .eq('student_id', studentId)
        .gte('end_date', new Date().toISOString().split('T')[0])
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('subscriptions')
        .select('id, start_date, end_date, paid_amount, subscription_plans(name)')
        .eq('student_id', studentId)
        .order('end_date', { ascending: false }),
      supabase
        .from('loyalty_ledger')
        .select('points_delta')
        .eq('student_id', studentId),
      supabase
        .from('attendance')
        .select('checked_in_at')
        .eq('student_id', studentId),
      supabase
        .from('profiles')
        .select('phone, university, study_level, created_at')
        .eq('id', studentId)
        .single(),
    ])

    const sub = subResult.data
    const points = (pointsResult.data ?? []).reduce((s, r) => s + (r.points_delta ?? 0), 0)
    // Multiple check-ins the same day (left and came back) still count as one visit
    const visits = new Set((visitsResult.data ?? []).map((r) => r.checked_in_at.slice(0, 10))).size

    return {
      planName: (sub?.subscription_plans as { name: string } | null)?.name ?? null,
      endDate: sub?.end_date ?? null,
      loyaltyPoints: points,
      totalVisits: visits,
      history: (historyResult.data ?? []).map((s) => ({
        id: s.id,
        startDate: s.start_date,
        endDate: s.end_date,
        paidAmount: s.paid_amount,
        planName: (s.subscription_plans as { name: string } | null)?.name ?? '—',
      })),
      phone: profileResult.data?.phone ?? null,
      university: profileResult.data?.university ?? null,
      studyLevel: profileResult.data?.study_level ?? null,
      createdAt: profileResult.data?.created_at ?? null,
    }
  })

export const getStudentAttendanceHistoryAction = employeeActionClient
  .schema(z.object({ studentId: z.string().uuid() }))
  .action(async ({ parsedInput: { studentId } }) => {
    const supabase = await createSupabaseClient()

    const { data: rows } = await supabase
      .from('attendance')
      .select('id, checked_in_at, checked_out_at, room_id, seat_id')
      .eq('student_id', studentId)
      .order('checked_in_at', { ascending: false })
      .limit(500)

    const attRows = rows ?? []
    const roomIds = [...new Set(attRows.map((r) => r.room_id).filter(Boolean))] as string[]
    const seatIds = [...new Set(attRows.map((r) => r.seat_id).filter(Boolean))] as string[]

    const [roomsResult, seatsResult] = await Promise.all([
      roomIds.length > 0 ? supabase.from('rooms').select('id, name').in('id', roomIds) : Promise.resolve({ data: [] }),
      seatIds.length > 0 ? supabase.from('seats').select('id, label').in('id', seatIds) : Promise.resolve({ data: [] }),
    ])

    const roomMap = Object.fromEntries((roomsResult.data ?? []).map((r) => [r.id, r.name]))
    const seatMap = Object.fromEntries((seatsResult.data ?? []).map((s) => [s.id, s.label]))

    return {
      rows: attRows.map((r) => ({
        id: r.id,
        checkedInAt: r.checked_in_at,
        checkedOutAt: r.checked_out_at,
        roomName: r.room_id ? (roomMap[r.room_id] ?? '—') : null,
        seatLabel: r.seat_id ? (seatMap[r.seat_id] ?? null) : null,
      })),
    }
  })

export const updateStudentInfoAction = employeeActionClient
  .schema(updateStudentSchema.omit({ email: true }))
  .action(async ({ parsedInput }) => {
    const { id, ...updates } = parsedInput
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('profiles').update(updates).eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/employee/students')
    return { success: true }
  })
