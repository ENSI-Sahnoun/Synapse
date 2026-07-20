'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export interface ChargeablePerson {
  id: string
  fullName: string
}

export async function listChargeablePeople(): Promise<ChargeablePerson[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['employee', 'admin'])
    .order('full_name', { ascending: true })
  if (error) throw new Error('Erreur de chargement des employés')
  return (data ?? []).map((p) => ({ id: p.id, fullName: p.full_name }))
}
