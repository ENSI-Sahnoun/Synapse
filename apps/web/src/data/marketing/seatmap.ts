import 'server-only'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'

export type LandingSeatmapMode = 'mock' | 'real'

export type PublicSeatSnapshot = {
  total: number
  occupied: number
}

/**
 * Landing page is public/unauthenticated (no session), and `settings`/`seats`
 * RLS both require `auth.uid()`. Reads here go through the service-role
 * client and only ever return an aggregate count — no row-level data leaves
 * this module.
 */
export async function getLandingSeatmapMode(): Promise<LandingSeatmapMode> {
  const supabase = createSupabaseAdminClient()
  const { data } = await supabase.from('settings').select('value').eq('key', 'landing_seatmap_mode').single()
  return data?.value === 'real' ? 'real' : 'mock'
}

export async function getPublicSeatSnapshot(): Promise<PublicSeatSnapshot> {
  const supabase = createSupabaseAdminClient()
  const [{ count: total }, { count: occupied }] = await Promise.all([
    supabase.from('seats').select('*', { count: 'exact', head: true }).neq('status', 'out_of_service'),
    supabase.from('seats').select('*', { count: 'exact', head: true }).eq('status', 'occupied'),
  ])
  return { total: total ?? 0, occupied: occupied ?? 0 }
}
