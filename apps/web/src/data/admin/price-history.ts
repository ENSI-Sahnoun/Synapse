'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export type PriceChangeEntry = {
  id: string
  oldPrice: number | null
  newPrice: number | null
  actorId: string
  createdAt: string
}

export function extractPriceChange(
  details: unknown,
): { oldPrice: number | null; newPrice: number | null } | null {
  if (!details || typeof details !== 'object') return null
  const d = details as { old?: { price_dt?: unknown }; new?: { price_dt?: unknown } }
  const oldPrice = typeof d.old?.price_dt === 'number' ? d.old.price_dt : null
  const newPrice = typeof d.new?.price_dt === 'number' ? d.new.price_dt : null
  if (oldPrice === null && newPrice === null) return null
  return { oldPrice, newPrice }
}

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
