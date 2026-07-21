import { createSupabaseClient } from '@/supabase-clients/server'

export type PurchaseTransaction = {
  type: 'purchase'
  id: string
  at: string
  who: string | null
  who_avatar_url: string | null
  items: { itemId: string; productId: string; name: string; qty: number; unitPrice: number }[]
  total: number
  voided: boolean
}
export type SubscriptionTransaction = {
  type: 'subscription'
  id: string
  at: string
  who: string | null
  who_avatar_url: string | null
  planId: string
  planName: string
  amount: number
  voided: boolean
}
export type ChargeTransaction = {
  type: 'charge'
  id: string
  at: string
  who: string
  who_avatar_url: string | null
  productId: string
  productName: string
  qty: number
  amount: number
}
export type Transaction = PurchaseTransaction | SubscriptionTransaction | ChargeTransaction

export function mergeTransactions(
  purchases: PurchaseTransaction[],
  subscriptions: SubscriptionTransaction[],
  charges: ChargeTransaction[],
): Transaction[] {
  return [...purchases, ...subscriptions, ...charges].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
}

export async function getTransactionLog(range: { from: string; to: string }): Promise<Transaction[]> {
  const supabase = await createSupabaseClient()
  const periodStart = range.from + 'T00:00:00'
  const periodEnd = range.to + 'T23:59:59'

  const [{ data: purchaseRows }, { data: subscriptionRows }, { data: chargeRows }] = await Promise.all([
    supabase
      .from('purchases')
      .select(
        'id, total_dt, created_at, voided_at, profiles!purchases_student_id_fkey(full_name, avatar_url), purchase_items(id, product_id, quantity, unit_price_dt, products(name))',
      )
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd)
      .order('created_at', { ascending: false }),
    supabase
      .from('subscriptions')
      .select('id, paid_amount, created_at, voided_at, plan_id, subscription_plans(name), profiles!subscriptions_student_id_fkey(full_name, avatar_url)')
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd)
      .order('created_at', { ascending: false }),
    supabase
      .from('pos_activity_log')
      .select('id, quantity, amount_dt, created_at, product_id, products(name), profiles(full_name, avatar_url)')
      .eq('action', 'employee_charge')
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd)
      .order('created_at', { ascending: false }),
  ])

  const purchases: PurchaseTransaction[] = (purchaseRows ?? []).map((p) => ({
    type: 'purchase',
    id: p.id,
    at: p.created_at,
    who: (p.profiles as unknown as { full_name: string; avatar_url: string | null } | null)?.full_name ?? null,
    who_avatar_url: (p.profiles as unknown as { full_name: string; avatar_url: string | null } | null)?.avatar_url ?? null,
    items: ((p.purchase_items as unknown as { id: string; product_id: string; quantity: number; unit_price_dt: number; products: { name: string } | null }[]) ?? []).map((i) => ({
      itemId: i.id,
      productId: i.product_id,
      name: i.products?.name ?? 'Produit supprimé',
      qty: Number(i.quantity),
      unitPrice: Number(i.unit_price_dt),
    })),
    total: Number(p.total_dt),
    voided: p.voided_at !== null,
  }))

  const subscriptions: SubscriptionTransaction[] = (subscriptionRows ?? []).map((s) => ({
    type: 'subscription',
    id: s.id,
    at: s.created_at,
    who: (s.profiles as unknown as { full_name: string; avatar_url: string | null } | null)?.full_name ?? null,
    who_avatar_url: (s.profiles as unknown as { full_name: string; avatar_url: string | null } | null)?.avatar_url ?? null,
    planId: s.plan_id,
    planName: (s.subscription_plans as unknown as { name: string } | null)?.name ?? 'Plan supprimé',
    amount: Number(s.paid_amount),
    voided: s.voided_at !== null,
  }))

  const charges: ChargeTransaction[] = (chargeRows ?? []).map((c) => ({
    type: 'charge',
    id: c.id,
    at: c.created_at,
    who: (c.profiles as unknown as { full_name: string; avatar_url: string | null } | null)?.full_name ?? 'Employé',
    who_avatar_url: (c.profiles as unknown as { full_name: string; avatar_url: string | null } | null)?.avatar_url ?? null,
    productId: c.product_id ?? '',
    productName: (c.products as unknown as { name: string } | null)?.name ?? 'Produit supprimé',
    qty: Number(c.quantity ?? 0),
    amount: Number(c.amount_dt ?? 0),
  }))

  return mergeTransactions(purchases, subscriptions, charges)
}
