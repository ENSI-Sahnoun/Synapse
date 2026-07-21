'use server'

import { createSupabaseClient } from '@/supabase-clients/server'
import { extractPriceChange, type PriceChangeEntry } from '@/data/admin/price-history-helpers'

export async function getProductPriceHistory(productId: string): Promise<PriceChangeEntry[]> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('pos_activity_log')
    .select('id, details, actor_id, created_at')
    .eq('product_id', productId)
    .in('action', ['product_create', 'product_update'])
    .order('created_at', { ascending: false })

  return (data ?? [])
    .map((r) => {
      const change = extractPriceChange(r.details)
      if (!change) return null
      return { id: r.id, ...change, actorId: r.actor_id, createdAt: r.created_at }
    })
    .filter((r): r is PriceChangeEntry => r !== null)
}

export async function getPlanPriceHistory(planId: string): Promise<PriceChangeEntry[]> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('subscription_plan_activity_log')
    .select('id, details, actor_id, created_at')
    .eq('plan_id', planId)
    .order('created_at', { ascending: false })

  return (data ?? [])
    .map((r) => {
      const change = extractPriceChange(r.details)
      if (!change) return null
      return { id: r.id, ...change, actorId: r.actor_id, createdAt: r.created_at }
    })
    .filter((r): r is PriceChangeEntry => r !== null)
}
