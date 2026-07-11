import 'server-only'
import type { createSupabaseClient } from '@/supabase-clients/server'
import { registryForRole, resolveNavOrder, type NavRole, type ResolvedNavItem } from '@/lib/nav-items'

export async function getResolvedNavItems(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  role: NavRole,
): Promise<ResolvedNavItem[]> {
  const settingKey = role === 'admin' ? 'nav_order_admin' : 'nav_order_employee'
  const { data } = await supabase.from('settings').select('value').eq('key', settingKey).single()
  return resolveNavOrder(registryForRole(role), data?.value ?? null)
}
