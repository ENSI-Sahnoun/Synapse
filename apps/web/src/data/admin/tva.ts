import { createSupabaseClient } from '@/supabase-clients/server'
import { roundDt } from '@/lib/tz'

export type TvaSummary = {
  revenueTtc: number
  revenueHt: number
  tvaCollected: number
  tvaDeductible: number
  tvaNetPayable: number
}

type TvaRpcRow = {
  revenue_ttc: string | number
  revenue_ht: string | number
  tva_collected: string | number
  tva_deductible: string | number
  tva_net_payable: string | number
}

type UntypedRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: TvaRpcRow[] | null; error: { message: string } | null }>

const EMPTY: TvaSummary = {
  revenueTtc: 0,
  revenueHt: 0,
  tvaCollected: 0,
  tvaDeductible: 0,
  tvaNetPayable: 0,
}

/**
 * TVA declaration for a period.
 *
 * Displayed prices are TTC (tax-inclusive) by convention, as in Tunisian
 * retail, so the tax inside an amount is `amount * rate / (100 + rate)` — not
 * `amount * rate / 100`. A 19% rate on a 119 DT sale contains 19 DT of TVA,
 * not 22.61.
 *
 * That makes `revenueHt` the real revenue figure: `tvaCollected` is money held
 * on behalf of the state and owed back to it, never income. Presenting
 * `revenueTtc` as "revenus" overstates the business by the whole tax take.
 * `tvaNetPayable` is what is actually remitted — collected on sales less what
 * is deductible on supplier purchases — and can be negative, which is a credit
 * carried forward rather than a payment due.
 */
export async function getTvaSummary(range: { from: string; to: string }): Promise<TvaSummary> {
  const supabase = await createSupabaseClient()

  const { data, error } = await (supabase.rpc as unknown as UntypedRpc)('analytics_tva', {
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw new Error(error.message)

  const row = data?.[0]
  if (!row) return EMPTY

  return {
    revenueTtc: roundDt(Number(row.revenue_ttc)),
    revenueHt: roundDt(Number(row.revenue_ht)),
    tvaCollected: roundDt(Number(row.tva_collected)),
    tvaDeductible: roundDt(Number(row.tva_deductible)),
    tvaNetPayable: roundDt(Number(row.tva_net_payable)),
  }
}
