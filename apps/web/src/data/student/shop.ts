'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export interface ShopSubscriptionPlan {
  id: string
  name: string
  price_dt: number
  duration_days: number
}

export interface ShopLockerFee {
  fee_dt: number
  min_duration_days: number
}

export interface ShopProduct {
  id: string
  name: string
  price_dt: number
  image_url: string | null
  stock_quantity: number
}

export interface ShopProductCategory {
  id: string
  name: string
  emoji: string | null
  products: ShopProduct[]
}

export async function getShopSubscriptionPlans(): Promise<ShopSubscriptionPlan[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('id, name, price_dt, duration_days')
    .order('price_dt', { ascending: true })
  if (error) throw new Error('Erreur de chargement des abonnements')
  return data ?? []
}

export async function getShopLockerFee(): Promise<ShopLockerFee> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['locker_fee_dt', 'locker_min_duration_days'])
  if (error) throw new Error('Erreur de chargement du tarif casiers')
  const map = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]))
  return {
    fee_dt: parseFloat(map.locker_fee_dt ?? '0'),
    min_duration_days: parseInt(map.locker_min_duration_days ?? '30', 10),
  }
}

export async function getShopProductsByCategory(): Promise<ShopProductCategory[]> {
  const supabase = await createSupabaseClient()
  const [{ data: categories, error: catError }, { data: products, error: prodError }] = await Promise.all([
    supabase
      .from('product_categories')
      .select('id, name, emoji, sort_order')
      .order('sort_order')
      .order('name'),
    supabase
      .from('products')
      .select('id, name, price_dt, image_url, stock_quantity, category, sort_order')
      .eq('is_active', true)
      .order('sort_order')
      .order('name'),
  ])
  if (catError) throw new Error('Erreur de chargement des catégories')
  if (prodError) throw new Error('Erreur de chargement des produits')

  return (categories ?? [])
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      emoji: cat.emoji,
      products: (products ?? [])
        .filter((p) => p.category === cat.name)
        .map((p) => ({
          id: p.id,
          name: p.name,
          price_dt: p.price_dt,
          image_url: p.image_url,
          stock_quantity: p.stock_quantity,
        })),
    }))
    .filter((cat) => cat.products.length > 0)
}
