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
