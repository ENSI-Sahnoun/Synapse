import { createSupabaseClient } from '@/supabase-clients/server'

export type LiveSnapshot = {
  studentsInside: number
  seatOccupancy: { occupied: number; total: number }
  todayRevenue: number
  expiringSoonCount: number
  lowStockProducts: Array<{ id: string; name: string; stock_quantity: number }>
}

export type DailySummary = {
  newStudents: number
  subscriptionsSold: number
  subscriptionsRevenue: number
  inStoreSales: number
  footfall: number
}

export type RevenuePoint = { date: string; revenue: number }
export type StudentTypePoint = { date: string; nouveaux: number; recurrents: number }
export type PlanPopularity = { name: string; value: number }
export type CustomMetricRow = {
  id: string
  name: string
  unit: string
  target_value: number | null
  current_value: number
}

const today = () => {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Tunis' }).format(new Date())
}

const startOfTomorrow = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Tunis' }).format(d) + 'T00:00:00'
}

export async function getLiveSnapshot(): Promise<LiveSnapshot> {
  const supabase = await createSupabaseClient()

  const todayStr = today()

  // Students currently inside (open attendance rows)
  const { count: studentsInside } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .is('checked_out_at', null)

  // Seat occupancy
  const { count: totalSeats } = await supabase
    .from('seats')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'out_of_service')

  const { count: occupiedSeats } = await supabase
    .from('seats')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'occupied')

  // Today's revenue: subscriptions + purchases
  const { data: subRevenue } = await supabase
    .from('subscriptions')
    .select('paid_amount')
    .gte('created_at', todayStr + 'T00:00:00')
    .lt('created_at', startOfTomorrow())

  const { data: purchaseRevenue } = await supabase
    .from('purchases')
    .select('total_dt')
    .gte('created_at', todayStr + 'T00:00:00')
    .lt('created_at', startOfTomorrow())

  const todayRevenue =
    (subRevenue?.reduce((s, r) => s + Number(r.paid_amount), 0) ?? 0) +
    (purchaseRevenue?.reduce((s, r) => s + Number(r.total_dt), 0) ?? 0)

  // Subscriptions expiring this week
  const weekLater = new Date()
  weekLater.setDate(weekLater.getDate() + 7)
  const { count: expiringSoonCount } = await supabase
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .gte('end_date', todayStr)
    .lte('end_date', weekLater.toISOString().slice(0, 10))

  // Low-stock products (stock <= 5)
  const { data: lowStockProducts } = await supabase
    .from('products')
    .select('id, name, stock_quantity')
    .eq('is_active', true)
    .lte('stock_quantity', 5)
    .order('stock_quantity', { ascending: true })
    .limit(10)

  return {
    studentsInside: studentsInside ?? 0,
    seatOccupancy: { occupied: occupiedSeats ?? 0, total: totalSeats ?? 60 },
    todayRevenue,
    expiringSoonCount: expiringSoonCount ?? 0,
    lowStockProducts: lowStockProducts ?? [],
  }
}

export async function getDailySummary(): Promise<DailySummary> {
  const supabase = await createSupabaseClient()
  const todayStr = today()
  const start = todayStr + 'T00:00:00'
  const end = startOfTomorrow()

  const { count: newStudents } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'student')
    .gte('created_at', start)
    .lt('created_at', end)

  const { data: subs } = await supabase
    .from('subscriptions')
    .select('paid_amount')
    .gte('created_at', start)
    .lt('created_at', end)

  const subscriptionsSold = subs?.length ?? 0
  const subscriptionsRevenue = subs?.reduce((s, r) => s + Number(r.paid_amount), 0) ?? 0

  const { data: purchases } = await supabase
    .from('purchases')
    .select('total_dt')
    .gte('created_at', start)
    .lt('created_at', end)

  const inStoreSales = purchases?.reduce((s, r) => s + Number(r.total_dt), 0) ?? 0

  const { count: footfall } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .gte('checked_in_at', start)
    .lt('checked_in_at', end)

  return {
    newStudents: newStudents ?? 0,
    subscriptionsSold,
    subscriptionsRevenue,
    inStoreSales,
    footfall: footfall ?? 0,
  }
}

export async function getRevenueOverTime(days = 30): Promise<RevenuePoint[]> {
  const supabase = await createSupabaseClient()
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().slice(0, 10)

  const { data: subs } = await supabase
    .from('subscriptions')
    .select('paid_amount, created_at')
    .gte('created_at', sinceStr)

  const { data: purchases } = await supabase
    .from('purchases')
    .select('total_dt, created_at')
    .gte('created_at', sinceStr)

  const map = new Map<string, number>()

  subs?.forEach((r) => {
    const d = r.created_at.slice(0, 10)
    map.set(d, (map.get(d) ?? 0) + Number(r.paid_amount))
  })
  purchases?.forEach((r) => {
    const d = r.created_at.slice(0, 10)
    map.set(d, (map.get(d) ?? 0) + Number(r.total_dt))
  })

  // Fill missing days with 0
  const result: RevenuePoint[] = []
  for (let i = days; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    result.push({ date: key, revenue: map.get(key) ?? 0 })
  }
  return result
}

export async function getStudentTypeSeries(days = 30): Promise<StudentTypePoint[]> {
  const supabase = await createSupabaseClient()
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().slice(0, 10)

  // Attendance rows with student join to detect new vs returning
  const { data: rows } = await supabase
    .from('attendance')
    .select('checked_in_at, student_id, profiles!inner(created_at)')
    .gte('checked_in_at', sinceStr)

  const newMap = new Map<string, Set<string>>()
  const retMap = new Map<string, Set<string>>()

  rows?.forEach((r) => {
    const checkDate = r.checked_in_at.slice(0, 10)
    // If profile created_at is on same day as check-in → new student
    const profileDate = (r.profiles as { created_at: string }).created_at.slice(0, 10)
    const isNew = profileDate === checkDate
    if (isNew) {
      if (!newMap.has(checkDate)) newMap.set(checkDate, new Set())
      newMap.get(checkDate)!.add(r.student_id)
    } else {
      if (!retMap.has(checkDate)) retMap.set(checkDate, new Set())
      retMap.get(checkDate)!.add(r.student_id)
    }
  })

  const result: StudentTypePoint[] = []
  for (let i = days; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    result.push({
      date: key,
      nouveaux: newMap.get(key)?.size ?? 0,
      recurrents: retMap.get(key)?.size ?? 0,
    })
  }
  return result
}

export async function getPlanPopularity(): Promise<PlanPopularity[]> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('plan_id, subscription_plans!inner(name)')

  const map = new Map<string, number>()
  data?.forEach((r) => {
    const name = (r.subscription_plans as { name: string }).name
    map.set(name, (map.get(name) ?? 0) + 1)
  })
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
}

export async function getCustomMetrics(): Promise<CustomMetricRow[]> {
  const supabase = await createSupabaseClient()
  const { data: metrics } = await supabase
    .from('custom_metrics')
    .select('*')
    .eq('is_dashboard_visible', true)
    .order('created_at')

  if (!metrics) return []

  // For now, current_value is always 0 unless we have a known mapping.
  // Admins define custom metrics manually; actual value collection is out of scope for 7A.
  return metrics.map((m) => ({
    id: m.id,
    name: m.name,
    unit: m.unit,
    target_value: m.target_value ? Number(m.target_value) : null,
    current_value: 0,
  }))
}
