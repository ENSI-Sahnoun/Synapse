import 'server-only'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'

export type LandingSeatmapMode = 'mock' | 'real'

export type PublicSeatRow = {
  id: string
  status: string
}

/**
 * Landing page is public/unauthenticated (no session), and `settings`/`seats`
 * RLS both required `auth.uid()` — reads here go through the service-role
 * client. `seats` also now has a narrow anon policy + column grant (id,
 * room_id, status only — see migration 20260719000000) purely so the
 * browser's own Realtime socket can receive postgres_changes events; this
 * server-side read still uses the service role and isn't bound by that.
 */
export async function getLandingSeatmapMode(): Promise<LandingSeatmapMode> {
  const supabase = createSupabaseAdminClient()
  const { data } = await supabase.from('settings').select('value').eq('key', 'landing_seatmap_mode').single()
  return data?.value === 'real' ? 'real' : 'mock'
}

export async function getPublicSeatRows(): Promise<PublicSeatRow[]> {
  const supabase = createSupabaseAdminClient()
  const { data } = await supabase.from('seats').select('id, status').neq('status', 'out_of_service')
  return data ?? []
}
