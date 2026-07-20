import { createSupabaseClient } from '@/supabase-clients/server'
import { roundDt } from '@/lib/tz'

export type LaborCost = {
  hoursWorked: number
  hourlyCostDt: number
  salariedCostDt: number
  totalCostDt: number
  /** Staff with at least one completed shift in the period. */
  staffCounted: number
  /**
   * Of those, how many carry neither an hourly rate nor a monthly salary.
   *
   * Any value above zero means every figure here is a FLOOR, not a total:
   * unrated staff contribute hours at 0 DT. The UI must say so explicitly —
   * a labour ratio that silently omits half the payroll reads as healthy
   * precisely when it is not.
   */
  staffUnrated: number
}

export type LaborRatio = LaborCost & {
  /** Labour as a share of revenue, or null when there is no revenue to divide by. */
  laborPct: number | null
}

type LaborSqlRow = {
  hours_worked: string | number
  hourly_cost_dt: string | number
  salaried_cost_dt: string | number
  total_cost_dt: string | number
  staff_counted: string | number
  staff_unrated: string | number
}

export async function getLaborCost(range: { from: string; to: string }): Promise<LaborCost> {
  const supabase = await createSupabaseClient()

  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: LaborSqlRow[] | null; error: { message: string } | null }>
  )('analytics_labor', { p_from: range.from, p_to: range.to })
  if (error) throw new Error(error.message)

  // Defensive only: the RPC is an ungrouped aggregate, so it always yields one
  // row — a period with no completed shift still reports salaried cost, which is
  // independent of attendance. Never widen this branch into a real code path.
  const row = data?.[0]
  if (!row) {
    return {
      hoursWorked: 0,
      hourlyCostDt: 0,
      salariedCostDt: 0,
      totalCostDt: 0,
      staffCounted: 0,
      staffUnrated: 0,
    }
  }

  return {
    hoursWorked: roundDt(Number(row.hours_worked)),
    hourlyCostDt: roundDt(Number(row.hourly_cost_dt)),
    salariedCostDt: roundDt(Number(row.salaried_cost_dt)),
    totalCostDt: roundDt(Number(row.total_cost_dt)),
    staffCounted: Number(row.staff_counted),
    staffUnrated: Number(row.staff_unrated),
  }
}

/**
 * Labour cost expressed against revenue for the same window.
 *
 * `revenue` is passed in rather than recomputed so this figure always agrees
 * with whatever revenue number the calling page is already showing.
 */
export async function getLaborRatio(
  range: { from: string; to: string },
  revenue: number,
): Promise<LaborRatio> {
  const cost = await getLaborCost(range)
  return {
    ...cost,
    laborPct: revenue > 0 ? roundDt((cost.totalCostDt / revenue) * 100) : null,
  }
}
