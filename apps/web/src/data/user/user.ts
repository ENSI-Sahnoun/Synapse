'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export async function getLoggedInUserId(): Promise<string> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims?.sub) {
    throw new Error('User not logged in')
  }
  return data.claims.sub
}

export async function getLoggedInUserProfile() {
  const supabase = await createSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('User not logged in')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) throw new Error('Profile not found')
  return profile
}
