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
  // Validate the JWT locally (getClaims, no network) instead of getUser (a
  // round-trip to Supabase Auth). This runs on every mutation via
  // safe-action's auth middleware, so the saved round-trip is felt directly
  // as snappier actions. The profile row (below) is still an RLS-gated query.
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims?.sub) throw new Error('User not logged in')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', data.claims.sub)
    .single()

  if (profileError || !profile) throw new Error('Profile not found')
  return profile
}
