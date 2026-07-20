import { createSupabaseClient } from '@/supabase-clients/server'
import { roundDt, tunisRange } from '@/lib/tz'

export type RefundSource = 'purchase' | 'subscription' | 'locker_payment'

export type RefundRow = {
  id: string
  source: RefundSource
  amountDt: number
  reason: string
  restocked: boolean
  createdAt: string
  createdByName: string
  targetLabel: string
}

export type RefundSummary = {
  subs: number
  pos: number
  lockers: number
  total: number
  refundCount: number
}

const TARGET_LABELS: Record<RefundSource, string> = {
  purchase: 'Vente comptoir',
  subscription: 'Abonnement',
  locker_payment: 'Casier',
}

type RefundSelectRow = {
  id: string
  source: RefundSource
  amount_dt: number | string
  reason: string
  restocked: boolean
  created_at: string
  created_by_profile: { full_name: string | null } | null
}

// `refunds` and `analytics_refunds` post-date the hand-maintained
// database.types.ts, so the client is cast locally rather than editing the
// shared type file.
type UntypedFrom = (table: string) => {
  select: (columns: string) => {
    gte: (
      col: string,
      value: string,
    ) => {
      lt: (
        col: string,
        value: string,
      ) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{ data: RefundSelectRow[] | null; error: { message: string } | null }>
      }
    }
  }
}

type RefundsRpcRow = {
  subs: string | number
  pos: string | number
  lockers: string | number
  total: string | number
  refund_count: string | number
}

type UntypedRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: RefundsRpcRow[] | null; error: { message: string } | null }>

export async function getRefunds(range: { from: string; to: string }): Promise<RefundRow[]> {
  const supabase = await createSupabaseClient()
  const { start, endExclusive } = tunisRange(range.from, range.to)

  const { data, error } = await (supabase.from as unknown as UntypedFrom)('refunds')
    .select(
      `id, source, amount_dt, reason, restocked, created_at,
       created_by_profile:profiles!refunds_created_by_fkey(full_name)`,
    )
    .gte('created_at', start)
    .lt('created_at', endExclusive)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((r) => ({
    id: r.id,
    source: r.source,
    amountDt: Number(r.amount_dt),
    reason: r.reason,
    restocked: r.restocked,
    createdAt: r.created_at,
    // `created_by` is NOT NULL, but the profile can be missing if the staff
    // account was removed after the refund was issued.
    createdByName: r.created_by_profile?.full_name ?? 'Utilisateur supprimé',
    targetLabel: TARGET_LABELS[r.source],
  }))
}

export async function getRefundSummary(range: { from: string; to: string }): Promise<RefundSummary> {
  const supabase = await createSupabaseClient()

  const { data, error } = await (supabase.rpc as unknown as UntypedRpc)('analytics_refunds', {
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw new Error(error.message)

  const row = data?.[0]
  if (!row) return { subs: 0, pos: 0, lockers: 0, total: 0, refundCount: 0 }

  return {
    subs: roundDt(Number(row.subs)),
    pos: roundDt(Number(row.pos)),
    lockers: roundDt(Number(row.lockers)),
    total: roundDt(Number(row.total)),
    refundCount: Number(row.refund_count),
  }
}
