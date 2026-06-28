'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export async function listAllProfiles(
  role?: 'student' | 'employee' | 'admin',
  showArchived = false,
  search?: string
) {
  const supabase = await createSupabaseClient()
  let query = supabase
    .from('profiles')
    .select('id, full_name, phone, role, university, study_level, is_archived, created_at')
    .order('created_at', { ascending: false })

  if (role) query = query.eq('role', role)
  query = query.eq('is_archived', showArchived)

  if (search) {
    const safe = search.replace(/[%,]/g, '')
    query = query.or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%`)
  }

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

  const [profileResult, subscriptionResult, plansResult, historyResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, phone, university, study_level, is_archived, qr_token, created_at')
      .eq('id', id)
      .eq('role', 'student')
      .single(),
    supabase
      .from('subscriptions')
      .select('id, start_date, end_date, paid_amount, plan_id, subscription_plans(id, name, duration_days, price_dt)')
      .eq('student_id', id)
      .gte('end_date', new Date().toISOString().split('T')[0])
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('subscription_plans')
      .select('id, name, duration_days, price_dt')
      .eq('is_active', true)
      .order('price_dt', { ascending: true }),
    supabase
      .from('subscriptions')
      .select('id, start_date, end_date, paid_amount, subscription_plans(name)')
      .eq('student_id', id)
      .order('start_date', { ascending: false }),
  ])

  if (profileResult.error) throw profileResult.error
  if (subscriptionResult.error) console.error('[getStudentWithSubscription] sub error:', subscriptionResult.error)

  return {
    profile: profileResult.data,
    subscription: subscriptionResult.data,
    plans: plansResult.data ?? [],
    history: historyResult.data ?? [],
  }
}
