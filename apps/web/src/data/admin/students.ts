'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export async function listAllProfiles(
  role?: 'student' | 'employee' | 'admin',
  showArchived = false
) {
  const supabase = await createSupabaseClient()
  let query = supabase
    .from('profiles')
    .select('id, full_name, phone, role, university, study_level, is_archived, created_at')
    .order('created_at', { ascending: false })

  if (role) query = query.eq('role', role)
  query = query.eq('is_archived', showArchived)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getProfileById(id: string) {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, role, university, study_level, is_archived, created_at')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function getStudentWithSubscription(id: string) {
  const supabase = await createSupabaseClient()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, phone, university, study_level, is_archived')
    .eq('id', id)
    .eq('role', 'student')
    .single()
  if (profileError) throw profileError

  const today = new Date().toISOString().split('T')[0]

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, start_date, end_date, paid_amount, plan_id, subscription_plans(id, name, duration_days, price_dt)')
    .eq('student_id', id)
    .gte('end_date', today)
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('id, name, duration_days, price_dt')
    .eq('is_active', true)
    .order('price_dt', { ascending: true })

  return { profile, subscription, plans: plans ?? [] }
}
