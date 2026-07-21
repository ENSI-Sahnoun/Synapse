'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { z } from 'zod'
import { createSupabaseClient } from '@/supabase-clients/server'

const lookupStudentByQrSchema = z.object({
  qr_token: z.string().min(1, 'Token QR requis'),
})

export const lookupStudentByQrAction = employeeActionClient
  .schema(lookupStudentByQrSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, avatar_url')
      .eq('qr_token', parsedInput.qr_token)
      .eq('role', 'student')
      .maybeSingle()

    if (error) throw new Error('Erreur de recherche')
    if (!profile) throw new Error('QR non reconnu')

    // Fetch current loyalty balance
    const { data: ledger } = await supabase
      .from('loyalty_ledger')
      .select('points_delta')
      .eq('student_id', profile.id)

    const balance = (ledger ?? []).reduce((sum, r) => sum + r.points_delta, 0)

    return {
      studentId: profile.id,
      fullName: profile.full_name,
      phone: profile.phone,
      avatarUrl: profile.avatar_url,
      loyaltyBalance: balance,
    }
  })
