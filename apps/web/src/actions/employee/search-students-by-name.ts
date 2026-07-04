'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { z } from 'zod'
import { createSupabaseClient } from '@/supabase-clients/server'

const searchStudentsByNameSchema = z.object({
  query: z.string().trim().min(2, 'Saisissez au moins 2 caractères'),
})

export const searchStudentsByNameAction = employeeActionClient
  .schema(searchStudentsByNameSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('role', 'student')
      .ilike('full_name', `%${parsedInput.query}%`)
      .order('full_name', { ascending: true })
      .limit(10)

    if (error) throw new Error('Erreur de recherche')
    if (!profiles || profiles.length === 0) return []

    // One query for all matches' ledger rows, aggregated in JS.
    const ids = profiles.map((p) => p.id)
    const { data: ledger } = await supabase
      .from('loyalty_ledger')
      .select('student_id, points_delta')
      .in('student_id', ids)

    const balances = new Map<string, number>()
    for (const row of ledger ?? []) {
      balances.set(row.student_id, (balances.get(row.student_id) ?? 0) + row.points_delta)
    }

    return profiles.map((p) => ({
      studentId: p.id,
      fullName: p.full_name,
      phone: p.phone,
      loyaltyBalance: balances.get(p.id) ?? 0,
    }))
  })
