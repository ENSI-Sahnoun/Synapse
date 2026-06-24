'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export async function listAllProfiles(role?: 'student' | 'employee' | 'admin') {
  const supabase = await createSupabaseClient()
  let query = supabase
    .from('profiles')
    .select('id, full_name, phone, role, university, study_level, created_at')
    .order('created_at', { ascending: false })

  if (role) query = query.eq('role', role)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}
