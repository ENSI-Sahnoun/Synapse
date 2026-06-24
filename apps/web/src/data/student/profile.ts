'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export async function getMyProfile() {
  const supabase = await createSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Non connecté')

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, university, study_level, qr_token, created_at')
    .eq('id', user.id)
    .single()

  if (error) throw error
  return data
}

export async function getMyActiveSubscription() {
  const supabase = await createSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw new Error('Session invalide')
  if (!user) return null

  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('subscriptions')
    .select(`
      id, start_date, end_date, paid_amount,
      subscription_plans ( name, duration_days )
    `)
    .eq('student_id', user.id)
    .gte('end_date', today)
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

export async function getMyLoyaltyBalance() {
  const supabase = await createSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw new Error('Session invalide')
  if (!user) return 0

  const { data } = await supabase
    .from('loyalty_ledger')
    .select('points_delta')
    .eq('student_id', user.id)

  return data?.reduce((sum, row) => sum + row.points_delta, 0) ?? 0
}
