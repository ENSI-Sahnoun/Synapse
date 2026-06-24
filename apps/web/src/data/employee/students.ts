'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export async function listStudents(search?: string) {
  const supabase = await createSupabaseClient()
  let query = supabase
    .from('profiles')
    .select('id, full_name, phone, university, study_level, created_at')
    .eq('role', 'student')
    .order('created_at', { ascending: false })

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getStudentById(id: string) {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, full_name, phone, university, study_level, qr_token, created_at,
      subscriptions (
        id, start_date, end_date, paid_amount, created_at,
        subscription_plans ( name, duration_days, price_dt )
      )
    `)
    .eq('id', id)
    .eq('role', 'student')
    .order('created_at', { ascending: false, foreignTable: 'subscriptions' })
    .single()

  if (error) throw error
  return data
}

export async function getActiveSubscription(studentId: string) {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('id, start_date, end_date, subscription_plans(name)')
    .eq('student_id', studentId)
    .gte('end_date', new Date().toISOString().split('T')[0])
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}
