'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export interface OpenCashSession {
  id: string
  openingAmountDt: number
  openedAt: string
  openedByName: string
}

// The currently open cash-register session, if any. The register is shared
// (single open session for the whole POS, enforced by a partial unique index),
// so this is a simple existence check rather than a per-employee lookup.
export async function getOpenCashSession(): Promise<OpenCashSession | null> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('cash_register_sessions')
    .select('id, opening_amount_dt, opened_at, profiles!cash_register_sessions_opened_by_fkey(full_name)')
    .eq('status', 'open')
    .maybeSingle()

  if (error) throw new Error('Erreur de chargement de la session de caisse')
  if (!data) return null

  return {
    id: data.id,
    openingAmountDt: Number(data.opening_amount_dt),
    openedAt: data.opened_at,
    openedByName: (data.profiles as unknown as { full_name: string } | null)?.full_name ?? 'Inconnu',
  }
}
