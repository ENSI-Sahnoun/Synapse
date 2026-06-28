'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { createPurchaseSchema } from '@/utils/zod-schemas/purchase'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'

export const createPurchaseAction = employeeActionClient
  .schema(createPurchaseSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { student_id, items } = parsedInput
    const supabase = await createSupabaseClient()

    // Fetch current product prices + stock to validate
    const productIds = items.map((i) => i.product_id)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, price_dt, stock_quantity, name, is_active')
      .in('id', productIds)

    if (productsError) throw new Error('Erreur de lecture des produits')

    const productMap = new Map(products?.map((p) => [p.id, p]) ?? [])

    // Validate each item
    for (const item of items) {
      const product = productMap.get(item.product_id)
      if (!product) throw new Error(`Produit introuvable: ${item.product_id}`)
      if (!product.is_active) throw new Error(`Produit inactif: ${product.name}`)
      if (product.stock_quantity < item.quantity) {
        throw new Error(
          `Stock insuffisant pour "${product.name}": ${product.stock_quantity} disponible(s), ${item.quantity} demandé(s)`
        )
      }
    }

    // Compute total using server-side prices (not client-supplied unit_price_dt)
    const total_dt = items.reduce((sum, item) => {
      const product = productMap.get(item.product_id)!
      return sum + product.price_dt * item.quantity
    }, 0)

    // Insert purchase
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        student_id: student_id ?? null,
        sold_by: ctx.userId,
        total_dt,
      })
      .select('id')
      .single()

    if (purchaseError) throw new Error('Erreur lors de la création de la vente')

    // Insert purchase items (using server-side prices)
    const purchaseItems = items.map((item) => ({
      purchase_id: purchase.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price_dt: productMap.get(item.product_id)!.price_dt,
    }))

    const { error: itemsError } = await supabase.from('purchase_items').insert(purchaseItems)
    if (itemsError) throw new Error('Erreur lors de la création des articles')

    // Decrement stock per product
    for (const item of items) {
      const product = productMap.get(item.product_id)!
      const { error: stockError } = await supabase
        .from('products')
        .update({ stock_quantity: product.stock_quantity - item.quantity })
        .eq('id', item.product_id)
      if (stockError) throw new Error('Erreur lors de la mise à jour du stock')
    }

    // Award loyalty points if student is linked
    let pointsEarned = 0
    if (student_id) {
      pointsEarned = Math.floor(total_dt)
      if (pointsEarned > 0) {
        const { error: loyaltyError } = await supabase.from('loyalty_ledger').insert({
          student_id,
          points_delta: pointsEarned,
          reason: 'purchase',
          ref_id: purchase.id,
        })
        if (loyaltyError) {
          // Non-fatal: purchase succeeded, log the error but don't throw
          console.error('Loyalty ledger insert failed:', loyaltyError.message)
          pointsEarned = 0
        }
      }
    }

    revalidatePath('/employee/pos')
    return {
      purchaseId: purchase.id,
      total_dt,
      pointsEarned,
      studentLinked: !!student_id,
    }
  })
