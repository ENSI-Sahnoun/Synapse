# Owner Financial Cockpit — Phase 4 (Analytics detail pages) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tasks 1–4 (one per page) are independent — any order, any subset can ship alone.

**Goal:** Build the four analytics detail pages: `/admin/analytics/subscriptions`, `/admin/analytics/pos`, `/admin/analytics/attendance`, `/admin/analytics/students-staff` — each with its spec-defined content.

**Architecture:** One data file per page under `apps/web/src/data/admin/analytics/{subscriptions,pos,attendance,students}.ts` (subscriptions.ts, pos.ts, attendance.ts, students.ts already exist from phase 1 — extend them, do not create students-staff.ts, reuse students.ts and add a sibling `staff.ts` for employee/shift queries since spec groups "students & staff" as one page but the data is two distinct domains). One page + a handful of small presentational components per section, following the existing `apps/web/src/components/admin/dashboard/*` card/chart pattern. Every page reuses `DateRangeFilter` (`@/components/admin/shared/date-range-filter`) and `defaultDateRange` (`@/lib/date-range`) exactly as `/admin/accounting` does.

**Tech Stack:** Next.js App Router server components, Supabase, Recharts, shadcn/ui Card/Table/Badge.

## Global Constraints

- French UI, currency "DT", money formatted `.toFixed(3)` (repo convention in `accounting.ts`/`PnlTable`).
- No new migrations. Phase-1 RPCs already cover the two heavy aggregations needed: `analytics_product_margin` (POS gross margin) and `analytics_peak_hours` (attendance heatmap) — both already wrapped by `getProductMargin`/`getPeakHours` in existing `pos.ts`/`attendance.ts`. Reuse them; do not re-implement.
- Reuse existing data functions instead of duplicating queries: `getPlanPopularity` (subscriptions.ts), `getStudentTypeSeries` (students.ts) stay as-is and get imported into the new pages.
- `export const dynamic = 'force-dynamic'` on every new page, matching `/admin/accounting` and `/admin/dashboard`.
- Each new data function gets one `assert`/`expect`-based unit test for its pure date/math logic (vitest, matching `overview.test.ts`/`accounting.test.ts` convention) — DB-touching parts are not unit-tested (no test harness for Supabase in this repo), only the extractable pure logic (date bucketing, discount math, ratio math).
- Reuse `DateRangeFilter` + `defaultDateRange` on every page — no new date picker.

---

### Task 1: Subscriptions detail page (`/admin/analytics/subscriptions`)

**Files:**
- Modify: `apps/web/src/data/admin/analytics/subscriptions.ts` (append)
- Test: `apps/web/src/data/admin/analytics/subscriptions.test.ts` (new)
- Create: `apps/web/src/components/admin/analytics/subscription-status-cards.tsx`
- Create: `apps/web/src/components/admin/analytics/revenue-per-plan-table.tsx`
- Create: `apps/web/src/app/admin/analytics/subscriptions/page.tsx`

**Interfaces:**
- Consumes: existing `getPlanPopularity` (no signature change), `createSupabaseClient`.
- Produces:
  ```ts
  export type SubscriptionStatusCounts = { active: number; expiringSoon: number; expired: number }
  export type PlanRevenue = { planName: string; revenue: number; count: number }
  export type AvgDiscount = { avgDiscount: number; avgDiscountPct: number }
  export function classifySubscriptionStatus(endDate: string, today: string, expiringSoonDays?: number): 'active' | 'expiring_soon' | 'expired'
  export async function getSubscriptionStatusCounts(asOf: string): Promise<SubscriptionStatusCounts>
  export async function getRevenuePerPlan(range: { from: string; to: string }): Promise<PlanRevenue[]>
  export async function getAvgDiscount(range: { from: string; to: string }): Promise<AvgDiscount>
  ```

- [ ] **Step 1: Write failing test for the pure classifier**

Create `apps/web/src/data/admin/analytics/subscriptions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { classifySubscriptionStatus } from './subscriptions'

describe('classifySubscriptionStatus', () => {
  it('is expired when end_date is before today', () => {
    expect(classifySubscriptionStatus('2026-06-01', '2026-07-04')).toBe('expired')
  })

  it('is expiring_soon when end_date is within 7 days', () => {
    expect(classifySubscriptionStatus('2026-07-08', '2026-07-04')).toBe('expiring_soon')
  })

  it('is active when end_date is more than 7 days out', () => {
    expect(classifySubscriptionStatus('2026-08-01', '2026-07-04')).toBe('active')
  })

  it('treats end_date equal to today as expiring_soon, not expired', () => {
    expect(classifySubscriptionStatus('2026-07-04', '2026-07-04')).toBe('expiring_soon')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/data/admin/analytics/subscriptions.test.ts`
Expected: FAIL — `classifySubscriptionStatus` not exported yet.

- [ ] **Step 3: Implement data functions**

Append to `apps/web/src/data/admin/analytics/subscriptions.ts`:

```ts
export type SubscriptionStatusCounts = { active: number; expiringSoon: number; expired: number }
export type PlanRevenue = { planName: string; revenue: number; count: number }
export type AvgDiscount = { avgDiscount: number; avgDiscountPct: number }

export function classifySubscriptionStatus(
  endDate: string,
  today: string,
  expiringSoonDays = 7,
): 'active' | 'expiring_soon' | 'expired' {
  if (endDate < today) return 'expired'
  const soonCutoff = new Date(today + 'T00:00:00Z')
  soonCutoff.setUTCDate(soonCutoff.getUTCDate() + expiringSoonDays)
  const cutoffStr = soonCutoff.toISOString().slice(0, 10)
  return endDate <= cutoffStr ? 'expiring_soon' : 'active'
}

export async function getSubscriptionStatusCounts(asOf: string): Promise<SubscriptionStatusCounts> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('subscriptions').select('end_date')

  const counts: SubscriptionStatusCounts = { active: 0, expiringSoon: 0, expired: 0 }
  data?.forEach((r) => {
    const status = classifySubscriptionStatus(r.end_date, asOf)
    if (status === 'active') counts.active++
    else if (status === 'expiring_soon') counts.expiringSoon++
    else counts.expired++
  })
  return counts
}

export async function getRevenuePerPlan(range: { from: string; to: string }): Promise<PlanRevenue[]> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('paid_amount, created_at, subscription_plans!inner(name)')
    .gte('created_at', range.from + 'T00:00:00')
    .lte('created_at', range.to + 'T23:59:59')

  const map = new Map<string, { revenue: number; count: number }>()
  data?.forEach((r) => {
    const name = (r.subscription_plans as { name: string }).name
    const existing = map.get(name) ?? { revenue: 0, count: 0 }
    existing.revenue += Number(r.paid_amount)
    existing.count += 1
    map.set(name, existing)
  })

  return Array.from(map.entries())
    .map(([planName, v]) => ({ planName, revenue: v.revenue, count: v.count }))
    .sort((a, b) => b.revenue - a.revenue)
}

export async function getAvgDiscount(range: { from: string; to: string }): Promise<AvgDiscount> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('paid_amount, created_at, subscription_plans!inner(price_dt)')
    .gte('created_at', range.from + 'T00:00:00')
    .lte('created_at', range.to + 'T23:59:59')

  if (!data || data.length === 0) return { avgDiscount: 0, avgDiscountPct: 0 }

  let totalDiscount = 0
  let totalPrice = 0
  data.forEach((r) => {
    const price = Number((r.subscription_plans as { price_dt: number }).price_dt)
    const paid = Number(r.paid_amount)
    totalDiscount += price - paid
    totalPrice += price
  })

  const avgDiscount = totalDiscount / data.length
  const avgDiscountPct = totalPrice > 0 ? (totalDiscount / totalPrice) * 100 : 0
  return { avgDiscount, avgDiscountPct }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/data/admin/analytics/subscriptions.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Status counts + avg-discount cards component**

Create `apps/web/src/components/admin/analytics/subscription-status-cards.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SubscriptionStatusCounts, AvgDiscount } from '@/data/admin/analytics/subscriptions'

type Props = { counts: SubscriptionStatusCounts; discount: AvgDiscount }

export function SubscriptionStatusCards({ counts, discount }: Props) {
  const tiles = [
    { label: 'Actifs', value: counts.active.toString() },
    { label: 'Expirent bientôt (≤7j)', value: counts.expiringSoon.toString() },
    { label: 'Expirés', value: counts.expired.toString() },
    {
      label: 'Remise moyenne',
      value: `${discount.avgDiscount.toFixed(3)} DT (${discount.avgDiscountPct.toFixed(1)}%)`,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{t.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Revenue-per-plan table component**

Create `apps/web/src/components/admin/analytics/revenue-per-plan-table.tsx`:

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PlanRevenue } from '@/data/admin/analytics/subscriptions'

type Props = { data: PlanRevenue[] }

export function RevenuePerPlanTable({ data }: Props) {
  const total = data.reduce((s, d) => s + d.revenue, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenus par formule</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Formule</TableHead>
              <TableHead className="text-right">Ventes</TableHead>
              <TableHead className="text-right">Revenus (DT)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Aucune vente sur la période
                </TableCell>
              </TableRow>
            ) : (
              data.map((r) => (
                <TableRow key={r.planName}>
                  <TableCell>{r.planName}</TableCell>
                  <TableCell className="text-right">{r.count}</TableCell>
                  <TableCell className="text-right font-mono">{r.revenue.toFixed(3)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-bold">Total</TableCell>
              <TableCell />
              <TableCell className="text-right font-bold font-mono">{total.toFixed(3)} DT</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 7: Page**

Create `apps/web/src/app/admin/analytics/subscriptions/page.tsx`:

```tsx
import {
  getPlanPopularity,
  getSubscriptionStatusCounts,
  getRevenuePerPlan,
  getAvgDiscount,
} from '@/data/admin/analytics/subscriptions'
import { PlanPieChart } from '@/components/admin/dashboard/plan-pie-chart'
import { SubscriptionStatusCards } from '@/components/admin/analytics/subscription-status-cards'
import { RevenuePerPlanTable } from '@/components/admin/analytics/revenue-per-plan-table'
import { DateRangeFilter } from '@/components/admin/shared/date-range-filter'
import { defaultDateRange } from '@/lib/date-range'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = { searchParams: Promise<{ from?: string; to?: string }> }

export default async function SubscriptionsAnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const defaults = defaultDateRange()
  const from = params.from ?? defaults.from
  const to = params.to ?? defaults.to
  const asOf = new Date().toISOString().slice(0, 10)

  const [planData, statusCounts, planRevenue, avgDiscount] = await Promise.all([
    getPlanPopularity(),
    getSubscriptionStatusCounts(asOf),
    getRevenuePerPlan({ from, to }),
    getAvgDiscount({ from, to }),
  ])

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Analyse — Abonnements</h1>
      <DateRangeFilter from={from} to={to} />
      <SubscriptionStatusCards counts={statusCounts} discount={avgDiscount} />
      <div className="grid gap-6 lg:grid-cols-2">
        <PlanPieChart data={planData} />
        <RevenuePerPlanTable data={planRevenue} />
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Typecheck + commit**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep -i subscriptions` — expect no output.

```bash
git add apps/web/src/data/admin/analytics/subscriptions.ts apps/web/src/data/admin/analytics/subscriptions.test.ts apps/web/src/components/admin/analytics/subscription-status-cards.tsx apps/web/src/components/admin/analytics/revenue-per-plan-table.tsx apps/web/src/app/admin/analytics/subscriptions/page.tsx
git commit -m "feat(analytics): add subscriptions detail page"
```

---

### Task 2: POS & products detail page (`/admin/analytics/pos`)

**Files:**
- Modify: `apps/web/src/data/admin/analytics/pos.ts` (append)
- Test: `apps/web/src/data/admin/analytics/pos.test.ts` (new)
- Create: `apps/web/src/components/admin/analytics/best-sellers-table.tsx`
- Create: `apps/web/src/components/admin/analytics/sales-by-category-chart.tsx`
- Create: `apps/web/src/components/admin/analytics/restock-history-table.tsx`
- Create: `apps/web/src/app/admin/analytics/pos/page.tsx`

**Interfaces:**
- Consumes: existing `getProductMargin` (pos.ts, unchanged), `LowStockPanel` component (`@/components/admin/dashboard/low-stock-panel`, expects `Array<{ id: string; name: string; stock_quantity: number }>`).
- Produces:
  ```ts
  export type BestSeller = { productId: string; productName: string; quantitySold: number; revenue: number }
  export type CategorySales = { category: string; revenue: number }
  export type RestockEvent = { id: string; productName: string; quantity: number; actorId: string; createdAt: string }
  export function rankBestSellers(rows: BestSeller[], limit?: number): BestSeller[]
  export async function getBestSellers(range: { from: string; to: string }, limit?: number): Promise<BestSeller[]>
  export async function getSalesByCategory(range: { from: string; to: string }): Promise<CategorySales[]>
  export async function getRestockHistory(range: { from: string; to: string }): Promise<RestockEvent[]>
  export async function getLowStockList(threshold?: number): Promise<Array<{ id: string; name: string; stock_quantity: number }>>
  ```

- [ ] **Step 1: Write failing test for the pure ranking helper**

Create `apps/web/src/data/admin/analytics/pos.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { rankBestSellers } from './pos'
import type { BestSeller } from './pos'

const sample: BestSeller[] = [
  { productId: '1', productName: 'A', quantitySold: 5, revenue: 50 },
  { productId: '2', productName: 'B', quantitySold: 20, revenue: 40 },
  { productId: '3', productName: 'C', quantitySold: 10, revenue: 100 },
]

describe('rankBestSellers', () => {
  it('sorts by quantity sold descending', () => {
    expect(rankBestSellers(sample).map((r) => r.productId)).toEqual(['2', '3', '1'])
  })

  it('respects the limit', () => {
    expect(rankBestSellers(sample, 2)).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/data/admin/analytics/pos.test.ts`
Expected: FAIL — `rankBestSellers`/`BestSeller` not exported yet.

- [ ] **Step 3: Implement data functions**

Append to `apps/web/src/data/admin/analytics/pos.ts`:

```ts
export type BestSeller = { productId: string; productName: string; quantitySold: number; revenue: number }
export type CategorySales = { category: string; revenue: number }
export type RestockEvent = { id: string; productName: string; quantity: number; actorId: string; createdAt: string }

export function rankBestSellers(rows: BestSeller[], limit = 10): BestSeller[] {
  return [...rows].sort((a, b) => b.quantitySold - a.quantitySold).slice(0, limit)
}

export async function getBestSellers(
  range: { from: string; to: string },
  limit = 10,
): Promise<BestSeller[]> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('purchase_items')
    .select('quantity, unit_price_dt, created_at, products!inner(id, name)')
    .gte('created_at', range.from + 'T00:00:00')
    .lte('created_at', range.to + 'T23:59:59')

  const map = new Map<string, BestSeller>()
  data?.forEach((r) => {
    const product = r.products as unknown as { id: string; name: string }
    const existing = map.get(product.id) ?? {
      productId: product.id,
      productName: product.name,
      quantitySold: 0,
      revenue: 0,
    }
    existing.quantitySold += Number(r.quantity)
    existing.revenue += Number(r.quantity) * Number(r.unit_price_dt)
    map.set(product.id, existing)
  })

  return rankBestSellers(Array.from(map.values()), limit)
}

export async function getSalesByCategory(range: { from: string; to: string }): Promise<CategorySales[]> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('purchase_items')
    .select('quantity, unit_price_dt, created_at, products!inner(category)')
    .gte('created_at', range.from + 'T00:00:00')
    .lte('created_at', range.to + 'T23:59:59')

  const map = new Map<string, number>()
  data?.forEach((r) => {
    const category = (r.products as unknown as { category: string }).category
    const amount = Number(r.quantity) * Number(r.unit_price_dt)
    map.set(category, (map.get(category) ?? 0) + amount)
  })

  return Array.from(map.entries())
    .map(([category, revenue]) => ({ category, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
}

export async function getRestockHistory(range: { from: string; to: string }): Promise<RestockEvent[]> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('pos_activity_log')
    .select('id, quantity, actor_id, created_at, products(name)')
    .eq('action', 'restock')
    .gte('created_at', range.from + 'T00:00:00')
    .lte('created_at', range.to + 'T23:59:59')
    .order('created_at', { ascending: false })

  return (data ?? []).map((r) => ({
    id: r.id,
    productName: (r.products as unknown as { name: string } | null)?.name ?? 'Produit supprimé',
    quantity: Number(r.quantity ?? 0),
    actorId: r.actor_id,
    createdAt: r.created_at,
  }))
}

export async function getLowStockList(
  threshold = 5,
): Promise<Array<{ id: string; name: string; stock_quantity: number }>> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('products')
    .select('id, name, stock_quantity')
    .eq('is_active', true)
    .lte('stock_quantity', threshold)
    .order('stock_quantity', { ascending: true })
  return data ?? []
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/data/admin/analytics/pos.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Best-sellers table component**

Create `apps/web/src/components/admin/analytics/best-sellers-table.tsx`:

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { BestSeller } from '@/data/admin/analytics/pos'

type Props = { data: BestSeller[] }

export function BestSellersTable({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Meilleures ventes</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead className="text-right">Qté vendue</TableHead>
              <TableHead className="text-right">Revenus (DT)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Aucune vente sur la période
                </TableCell>
              </TableRow>
            ) : (
              data.map((r) => (
                <TableRow key={r.productId}>
                  <TableCell>{r.productName}</TableCell>
                  <TableCell className="text-right">{r.quantitySold}</TableCell>
                  <TableCell className="text-right font-mono">{r.revenue.toFixed(3)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 6: Sales-by-category chart component**

Create `apps/web/src/components/admin/analytics/sales-by-category-chart.tsx`:

```tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CategorySales } from '@/data/admin/analytics/pos'

type Props = { data: CategorySales[] }

export function SalesByCategoryChart({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventes par catégorie</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} unit=" DT" />
            <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={100} />
            <Tooltip formatter={(v: number) => `${v.toFixed(3)} DT`} />
            <Bar dataKey="revenue" fill="#6366f1" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 7: Restock history table component**

Create `apps/web/src/components/admin/analytics/restock-history-table.tsx`:

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RestockEvent } from '@/data/admin/analytics/pos'

type Props = { data: RestockEvent[] }

export function RestockHistoryTable({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique de réapprovisionnement</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Produit</TableHead>
              <TableHead className="text-right">Quantité</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Aucun réapprovisionnement sur la période
                </TableCell>
              </TableRow>
            ) : (
              data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.createdAt).toLocaleString('fr-FR')}</TableCell>
                  <TableCell>{r.productName}</TableCell>
                  <TableCell className="text-right">+{r.quantity}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 8: Page**

Create `apps/web/src/app/admin/analytics/pos/page.tsx`:

```tsx
import {
  getProductMargin,
  getBestSellers,
  getSalesByCategory,
  getRestockHistory,
  getLowStockList,
} from '@/data/admin/analytics/pos'
import { BestSellersTable } from '@/components/admin/analytics/best-sellers-table'
import { SalesByCategoryChart } from '@/components/admin/analytics/sales-by-category-chart'
import { RestockHistoryTable } from '@/components/admin/analytics/restock-history-table'
import { LowStockPanel } from '@/components/admin/dashboard/low-stock-panel'
import { DateRangeFilter } from '@/components/admin/shared/date-range-filter'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { defaultDateRange } from '@/lib/date-range'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = { searchParams: Promise<{ from?: string; to?: string }> }

export default async function PosAnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const defaults = defaultDateRange()
  const from = params.from ?? defaults.from
  const to = params.to ?? defaults.to

  const [margin, bestSellers, byCategory, restocks, lowStock] = await Promise.all([
    getProductMargin({ from, to }),
    getBestSellers({ from, to }),
    getSalesByCategory({ from, to }),
    getRestockHistory({ from, to }),
    getLowStockList(),
  ])

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Analyse — Boutique &amp; produits</h1>
      <DateRangeFilter from={from} to={to} />

      <div className="grid gap-6 lg:grid-cols-2">
        <BestSellersTable data={bestSellers} />
        <SalesByCategoryChart data={byCategory} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Marge brute par produit</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Qté</TableHead>
                <TableHead className="text-right">Revenus (DT)</TableHead>
                <TableHead className="text-right">COGS (DT)</TableHead>
                <TableHead className="text-right">Marge (DT)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {margin.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Aucune vente sur la période
                  </TableCell>
                </TableRow>
              ) : (
                margin.map((r) => (
                  <TableRow key={r.productId}>
                    <TableCell>
                      {r.productName}
                      {r.costMissing && <span className="ml-1 text-xs text-amber-600">⚠ coût manquant</span>}
                    </TableCell>
                    <TableCell className="text-right">{r.quantitySold}</TableCell>
                    <TableCell className="text-right font-mono">{r.revenue.toFixed(3)}</TableCell>
                    <TableCell className="text-right font-mono">{r.cogs.toFixed(3)}</TableCell>
                    <TableCell className="text-right font-mono">{r.margin.toFixed(3)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <LowStockPanel products={lowStock} />
        <RestockHistoryTable data={restocks} />
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Typecheck + commit**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep -iE "analytics/pos|pos\.ts"` — expect no output.

```bash
git add apps/web/src/data/admin/analytics/pos.ts apps/web/src/data/admin/analytics/pos.test.ts apps/web/src/components/admin/analytics/best-sellers-table.tsx apps/web/src/components/admin/analytics/sales-by-category-chart.tsx apps/web/src/components/admin/analytics/restock-history-table.tsx apps/web/src/app/admin/analytics/pos/page.tsx
git commit -m "feat(analytics): add POS & products detail page"
```

---

### Task 3: Attendance & occupancy detail page (`/admin/analytics/attendance`)

**Files:**
- Modify: `apps/web/src/data/admin/analytics/attendance.ts` (append)
- Test: `apps/web/src/data/admin/analytics/attendance.test.ts` (new)
- Create: `apps/web/src/components/admin/analytics/peak-hours-heatmap.tsx`
- Create: `apps/web/src/app/admin/analytics/attendance/page.tsx`

**Interfaces:**
- Consumes: existing `getPeakHours` (unchanged).
- Produces:
  ```ts
  export type Occupancy = { occupied: number; total: number }
  export type SessionDuration = { avgMinutes: number; sessionsCounted: number }
  export type EntryMethodSplit = { method: string; count: number }
  export function averageSessionMinutes(sessions: Array<{ checkedInAt: string; checkedOutAt: string }>): number
  export async function getCurrentOccupancy(): Promise<Occupancy>
  export async function getAvgSessionDuration(range: { from: string; to: string }): Promise<SessionDuration>
  export async function getEntryMethodSplit(range: { from: string; to: string }): Promise<EntryMethodSplit[]>
  ```

- [ ] **Step 1: Write failing test for the pure duration averager**

Create `apps/web/src/data/admin/analytics/attendance.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { averageSessionMinutes } from './attendance'

describe('averageSessionMinutes', () => {
  it('averages minutes between check-in and check-out', () => {
    const sessions = [
      { checkedInAt: '2026-07-04T10:00:00Z', checkedOutAt: '2026-07-04T11:00:00Z' }, // 60 min
      { checkedInAt: '2026-07-04T10:00:00Z', checkedOutAt: '2026-07-04T10:30:00Z' }, // 30 min
    ]
    expect(averageSessionMinutes(sessions)).toBe(45)
  })

  it('returns 0 for no sessions', () => {
    expect(averageSessionMinutes([])).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/data/admin/analytics/attendance.test.ts`
Expected: FAIL — `averageSessionMinutes` not exported yet.

- [ ] **Step 3: Implement data functions**

Append to `apps/web/src/data/admin/analytics/attendance.ts`:

```ts
export type Occupancy = { occupied: number; total: number }
export type SessionDuration = { avgMinutes: number; sessionsCounted: number }
export type EntryMethodSplit = { method: string; count: number }

export function averageSessionMinutes(
  sessions: Array<{ checkedInAt: string; checkedOutAt: string }>,
): number {
  if (sessions.length === 0) return 0
  const totalMinutes = sessions.reduce((sum, s) => {
    const minutes = (new Date(s.checkedOutAt).getTime() - new Date(s.checkedInAt).getTime()) / 60_000
    return sum + minutes
  }, 0)
  return totalMinutes / sessions.length
}

export async function getCurrentOccupancy(): Promise<Occupancy> {
  const supabase = await createSupabaseClient()

  const [{ count: total }, { count: occupied }] = await Promise.all([
    supabase.from('seats').select('*', { count: 'exact', head: true }).neq('status', 'out_of_service'),
    supabase.from('seats').select('*', { count: 'exact', head: true }).eq('status', 'occupied'),
  ])

  return { occupied: occupied ?? 0, total: total ?? 0 }
}

export async function getAvgSessionDuration(range: { from: string; to: string }): Promise<SessionDuration> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('attendance')
    .select('checked_in_at, checked_out_at')
    .not('checked_out_at', 'is', null)
    .gte('checked_in_at', range.from + 'T00:00:00')
    .lte('checked_in_at', range.to + 'T23:59:59')

  const sessions = (data ?? []).map((r) => ({
    checkedInAt: r.checked_in_at,
    checkedOutAt: r.checked_out_at as string,
  }))

  return { avgMinutes: averageSessionMinutes(sessions), sessionsCounted: sessions.length }
}

export async function getEntryMethodSplit(range: { from: string; to: string }): Promise<EntryMethodSplit[]> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('attendance')
    .select('entry_method')
    .gte('checked_in_at', range.from + 'T00:00:00')
    .lte('checked_in_at', range.to + 'T23:59:59')

  const map = new Map<string, number>()
  data?.forEach((r) => {
    map.set(r.entry_method, (map.get(r.entry_method) ?? 0) + 1)
  })
  return Array.from(map.entries()).map(([method, count]) => ({ method, count }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/data/admin/analytics/attendance.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Peak-hours heatmap component**

Create `apps/web/src/components/admin/analytics/peak-hours-heatmap.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PeakHoursPoint } from '@/data/admin/analytics/attendance'

const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

type Props = { data: PeakHoursPoint[] }

export function PeakHoursHeatmap({ data }: Props) {
  const map = new Map<string, number>()
  let max = 0
  data.forEach((p) => {
    map.set(`${p.weekday}-${p.hour}`, p.visits)
    if (p.visits > max) max = p.visits
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Heures de pointe</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-1 text-left"></th>
              {HOURS.map((h) => (
                <th key={h} className="p-1 text-center font-normal text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS.map((label, weekday) => (
              <tr key={weekday}>
                <td className="p-1 font-medium text-muted-foreground">{label}</td>
                {HOURS.map((hour) => {
                  const visits = map.get(`${weekday}-${hour}`) ?? 0
                  const intensity = max > 0 ? visits / max : 0
                  return (
                    <td key={hour} className="p-0.5">
                      <div
                        title={`${visits} visites`}
                        className="h-5 w-5 rounded-sm"
                        style={{ backgroundColor: `rgba(99, 102, 241, ${intensity})` }}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 6: Page**

Create `apps/web/src/app/admin/analytics/attendance/page.tsx`:

```tsx
import {
  getPeakHours,
  getCurrentOccupancy,
  getAvgSessionDuration,
  getEntryMethodSplit,
} from '@/data/admin/analytics/attendance'
import { PeakHoursHeatmap } from '@/components/admin/analytics/peak-hours-heatmap'
import { DateRangeFilter } from '@/components/admin/shared/date-range-filter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { defaultDateRange } from '@/lib/date-range'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = { searchParams: Promise<{ from?: string; to?: string }> }

export default async function AttendanceAnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const defaults = defaultDateRange()
  const from = params.from ?? defaults.from
  const to = params.to ?? defaults.to

  const [occupancy, peakHours, sessionDuration, entrySplit] = await Promise.all([
    getCurrentOccupancy(),
    getPeakHours({ from, to }),
    getAvgSessionDuration({ from, to }),
    getEntryMethodSplit({ from, to }),
  ])

  const occupancyPct = occupancy.total > 0 ? Math.round((occupancy.occupied / occupancy.total) * 100) : 0

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Analyse — Fréquentation &amp; occupation</h1>
      <DateRangeFilter from={from} to={to} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Occupation actuelle</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {occupancy.occupied}/{occupancy.total}
            </p>
            <p className="text-sm text-muted-foreground">{occupancyPct}% occupé</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Durée moyenne de session</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{sessionDuration.avgMinutes.toFixed(0)} min</p>
            <p className="text-sm text-muted-foreground">{sessionDuration.sessionsCounted} sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Méthode d&apos;entrée</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {entrySplit.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnée</p>
            ) : (
              entrySplit.map((e) => (
                <p key={e.method} className="text-sm">
                  {e.method}: <span className="font-semibold">{e.count}</span>
                </p>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <PeakHoursHeatmap data={peakHours} />
    </div>
  )
}
```

- [ ] **Step 7: Typecheck + commit**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep -iE "analytics/attendance|attendance\.ts"` — expect no output.

```bash
git add apps/web/src/data/admin/analytics/attendance.ts apps/web/src/data/admin/analytics/attendance.test.ts apps/web/src/components/admin/analytics/peak-hours-heatmap.tsx apps/web/src/app/admin/analytics/attendance/page.tsx
git commit -m "feat(analytics): add attendance & occupancy detail page"
```

---

### Task 4: Students & staff detail page (`/admin/analytics/students-staff`)

**Files:**
- Modify: `apps/web/src/data/admin/analytics/students.ts` (append)
- Create: `apps/web/src/data/admin/analytics/staff.ts`
- Test: `apps/web/src/data/admin/analytics/staff.test.ts` (new)
- Create: `apps/web/src/components/admin/analytics/student-breakdown-cards.tsx`
- Create: `apps/web/src/components/admin/analytics/top-students-table.tsx`
- Create: `apps/web/src/components/admin/analytics/employee-revenue-table.tsx`
- Create: `apps/web/src/app/admin/analytics/students-staff/page.tsx`

**Interfaces:**
- Consumes: existing `getStudentTypeSeries` (students.ts, unchanged), `StudentTypeChart` (`@/components/admin/dashboard/student-type-chart`).
- Produces (students.ts additions):
  ```ts
  export type UniversityBreakdown = { university: string; count: number }
  export type StudyLevelBreakdown = { studyLevel: string; count: number }
  export type TopStudentByLoyalty = { studentId: string; fullName: string; points: number }
  export type TopStudentBySpend = { studentId: string; fullName: string; totalSpend: number }
  export async function getStudentBreakdown(): Promise<{ byUniversity: UniversityBreakdown[]; byStudyLevel: StudyLevelBreakdown[] }>
  export async function getTopStudentsByLoyalty(limit?: number): Promise<TopStudentByLoyalty[]>
  export async function getTopStudentsBySpend(range: { from: string; to: string }, limit?: number): Promise<TopStudentBySpend[]>
  ```
- Produces (`staff.ts`, new file):
  ```ts
  export type EmployeeRevenue = { employeeId: string; fullName: string; revenue: number; transactions: number }
  export type ShiftsSummary = { employeeId: string; fullName: string; shiftsWorked: number; salesPerShift: number }
  export function salesPerShift(totalSales: number, shiftsWorked: number): number
  export async function getEmployeeRevenue(range: { from: string; to: string }): Promise<EmployeeRevenue[]>
  export async function getShiftsSummary(range: { from: string; to: string }): Promise<ShiftsSummary[]>
  ```
  `getShiftsSummary` computes `shiftsWorked` = count of `shifts` rows per employee in range, and reuses `getEmployeeRevenue`'s per-employee sales total for `salesPerShift` (no separate per-shift sales join — ponytail: shift-level sales attribution needs a shift_id FK on purchases/subscriptions which doesn't exist; this approximates with period-total ÷ shift-count, documented inline).

- [ ] **Step 1: Write failing test for the pure `salesPerShift` helper**

Create `apps/web/src/data/admin/analytics/staff.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { salesPerShift } from './staff'

describe('salesPerShift', () => {
  it('divides total sales by shifts worked', () => {
    expect(salesPerShift(300, 4)).toBe(75)
  })

  it('returns 0 when no shifts worked', () => {
    expect(salesPerShift(300, 0)).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/data/admin/analytics/staff.test.ts`
Expected: FAIL — `apps/web/src/data/admin/analytics/staff.ts` doesn't exist yet.

- [ ] **Step 3: Implement `students.ts` additions**

Append to `apps/web/src/data/admin/analytics/students.ts`:

```ts
export type UniversityBreakdown = { university: string; count: number }
export type StudyLevelBreakdown = { studyLevel: string; count: number }
export type TopStudentByLoyalty = { studentId: string; fullName: string; points: number }
export type TopStudentBySpend = { studentId: string; fullName: string; totalSpend: number }

export async function getStudentBreakdown(): Promise<{
  byUniversity: UniversityBreakdown[]
  byStudyLevel: StudyLevelBreakdown[]
}> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('profiles')
    .select('university, study_level')
    .eq('role', 'student')
    .eq('is_archived', false)

  const uniMap = new Map<string, number>()
  const levelMap = new Map<string, number>()
  data?.forEach((r) => {
    const uni = r.university ?? 'Non renseigné'
    const level = r.study_level ?? 'Non renseigné'
    uniMap.set(uni, (uniMap.get(uni) ?? 0) + 1)
    levelMap.set(level, (levelMap.get(level) ?? 0) + 1)
  })

  return {
    byUniversity: Array.from(uniMap.entries())
      .map(([university, count]) => ({ university, count }))
      .sort((a, b) => b.count - a.count),
    byStudyLevel: Array.from(levelMap.entries())
      .map(([studyLevel, count]) => ({ studyLevel, count }))
      .sort((a, b) => b.count - a.count),
  }
}

export async function getTopStudentsByLoyalty(limit = 10): Promise<TopStudentByLoyalty[]> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('loyalty_ledger').select('student_id, points_delta, profiles!inner(full_name)')

  const map = new Map<string, { fullName: string; points: number }>()
  data?.forEach((r) => {
    const fullName = (r.profiles as unknown as { full_name: string }).full_name
    const existing = map.get(r.student_id) ?? { fullName, points: 0 }
    existing.points += Number(r.points_delta)
    map.set(r.student_id, existing)
  })

  return Array.from(map.entries())
    .map(([studentId, v]) => ({ studentId, fullName: v.fullName, points: v.points }))
    .sort((a, b) => b.points - a.points)
    .slice(0, limit)
}

export async function getTopStudentsBySpend(
  range: { from: string; to: string },
  limit = 10,
): Promise<TopStudentBySpend[]> {
  const supabase = await createSupabaseClient()

  const [{ data: subs }, { data: purchases }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('student_id, paid_amount, created_at, profiles!inner(full_name)')
      .gte('created_at', range.from + 'T00:00:00')
      .lte('created_at', range.to + 'T23:59:59'),
    supabase
      .from('purchases')
      .select('student_id, total_dt, created_at, profiles(full_name)')
      .gte('created_at', range.from + 'T00:00:00')
      .lte('created_at', range.to + 'T23:59:59')
      .not('student_id', 'is', null),
  ])

  const map = new Map<string, { fullName: string; totalSpend: number }>()
  subs?.forEach((r) => {
    const fullName = (r.profiles as unknown as { full_name: string }).full_name
    const existing = map.get(r.student_id) ?? { fullName, totalSpend: 0 }
    existing.totalSpend += Number(r.paid_amount)
    map.set(r.student_id, existing)
  })
  purchases?.forEach((r) => {
    if (!r.student_id) return
    const fullName = (r.profiles as unknown as { full_name: string } | null)?.full_name ?? 'Inconnu'
    const existing = map.get(r.student_id) ?? { fullName, totalSpend: 0 }
    existing.totalSpend += Number(r.total_dt)
    map.set(r.student_id, existing)
  })

  return Array.from(map.entries())
    .map(([studentId, v]) => ({ studentId, fullName: v.fullName, totalSpend: v.totalSpend }))
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, limit)
}
```

- [ ] **Step 4: Implement `staff.ts`**

Create `apps/web/src/data/admin/analytics/staff.ts`:

```ts
import { createSupabaseClient } from '@/supabase-clients/server'

export type EmployeeRevenue = { employeeId: string; fullName: string; revenue: number; transactions: number }
export type ShiftsSummary = { employeeId: string; fullName: string; shiftsWorked: number; salesPerShift: number }

export function salesPerShift(totalSales: number, shiftsWorked: number): number {
  return shiftsWorked > 0 ? totalSales / shiftsWorked : 0
}

export async function getEmployeeRevenue(range: { from: string; to: string }): Promise<EmployeeRevenue[]> {
  const supabase = await createSupabaseClient()

  const [{ data: subs }, { data: purchases }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('sold_by, paid_amount, created_at, profiles!subscriptions_sold_by_fkey(full_name)')
      .gte('created_at', range.from + 'T00:00:00')
      .lte('created_at', range.to + 'T23:59:59'),
    supabase
      .from('purchases')
      .select('sold_by, total_dt, created_at, profiles!purchases_sold_by_fkey(full_name)')
      .gte('created_at', range.from + 'T00:00:00')
      .lte('created_at', range.to + 'T23:59:59'),
  ])

  const map = new Map<string, { fullName: string; revenue: number; transactions: number }>()
  subs?.forEach((r) => {
    const fullName = (r.profiles as unknown as { full_name: string }).full_name
    const existing = map.get(r.sold_by) ?? { fullName, revenue: 0, transactions: 0 }
    existing.revenue += Number(r.paid_amount)
    existing.transactions += 1
    map.set(r.sold_by, existing)
  })
  purchases?.forEach((r) => {
    const fullName = (r.profiles as unknown as { full_name: string }).full_name
    const existing = map.get(r.sold_by) ?? { fullName, revenue: 0, transactions: 0 }
    existing.revenue += Number(r.total_dt)
    existing.transactions += 1
    map.set(r.sold_by, existing)
  })

  return Array.from(map.entries())
    .map(([employeeId, v]) => ({ employeeId, fullName: v.fullName, revenue: v.revenue, transactions: v.transactions }))
    .sort((a, b) => b.revenue - a.revenue)
}

export async function getShiftsSummary(range: { from: string; to: string }): Promise<ShiftsSummary[]> {
  const supabase = await createSupabaseClient()

  const [{ data: shifts }, revenue] = await Promise.all([
    supabase
      .from('shifts')
      .select('employee_id, start_time, profiles!shifts_employee_id_fkey(full_name)')
      .gte('start_time', range.from + 'T00:00:00')
      .lte('start_time', range.to + 'T23:59:59'),
    getEmployeeRevenue(range),
  ])

  const revenueMap = new Map(revenue.map((r) => [r.employeeId, r.revenue]))
  const shiftMap = new Map<string, { fullName: string; shiftsWorked: number }>()

  shifts?.forEach((r) => {
    const fullName = (r.profiles as unknown as { full_name: string }).full_name
    const existing = shiftMap.get(r.employee_id) ?? { fullName, shiftsWorked: 0 }
    existing.shiftsWorked += 1
    shiftMap.set(r.employee_id, existing)
  })

  return Array.from(shiftMap.entries()).map(([employeeId, v]) => ({
    employeeId,
    fullName: v.fullName,
    shiftsWorked: v.shiftsWorked,
    salesPerShift: salesPerShift(revenueMap.get(employeeId) ?? 0, v.shiftsWorked),
  }))
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/data/admin/analytics/staff.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Student breakdown cards component**

Create `apps/web/src/components/admin/analytics/student-breakdown-cards.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { UniversityBreakdown, StudyLevelBreakdown } from '@/data/admin/analytics/students'

type Props = { byUniversity: UniversityBreakdown[]; byStudyLevel: StudyLevelBreakdown[] }

export function StudentBreakdownCards({ byUniversity, byStudyLevel }: Props) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Par université</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {byUniversity.map((u) => (
            <p key={u.university} className="flex justify-between text-sm">
              <span>{u.university}</span>
              <span className="font-semibold">{u.count}</span>
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Par niveau d&apos;étude</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {byStudyLevel.map((l) => (
            <p key={l.studyLevel} className="flex justify-between text-sm">
              <span>{l.studyLevel}</span>
              <span className="font-semibold">{l.count}</span>
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 7: Top students table component**

Create `apps/web/src/components/admin/analytics/top-students-table.tsx`:

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TopStudentByLoyalty, TopStudentBySpend } from '@/data/admin/analytics/students'

type Props = { byLoyalty: TopStudentByLoyalty[]; bySpend: TopStudentBySpend[] }

export function TopStudentsTable({ byLoyalty, bySpend }: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Top étudiants — points fidélité</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Étudiant</TableHead>
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byLoyalty.map((s) => (
                <TableRow key={s.studentId}>
                  <TableCell>{s.fullName}</TableCell>
                  <TableCell className="text-right font-mono">{s.points}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top étudiants — dépenses</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Étudiant</TableHead>
                <TableHead className="text-right">Total (DT)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bySpend.map((s) => (
                <TableRow key={s.studentId}>
                  <TableCell>{s.fullName}</TableCell>
                  <TableCell className="text-right font-mono">{s.totalSpend.toFixed(3)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 8: Employee revenue + shifts table component**

Create `apps/web/src/components/admin/analytics/employee-revenue-table.tsx`:

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { EmployeeRevenue } from '@/data/admin/analytics/staff'
import type { ShiftsSummary } from '@/data/admin/analytics/staff'

type Props = { revenue: EmployeeRevenue[]; shifts: ShiftsSummary[] }

export function EmployeeRevenueTable({ revenue, shifts }: Props) {
  const shiftsMap = new Map(shifts.map((s) => [s.employeeId, s]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenus par employé</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employé</TableHead>
              <TableHead className="text-right">Transactions</TableHead>
              <TableHead className="text-right">Revenus (DT)</TableHead>
              <TableHead className="text-right">Shifts</TableHead>
              <TableHead className="text-right">Ventes/shift (DT)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {revenue.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Aucune vente sur la période
                </TableCell>
              </TableRow>
            ) : (
              revenue.map((r) => {
                const shift = shiftsMap.get(r.employeeId)
                return (
                  <TableRow key={r.employeeId}>
                    <TableCell>{r.fullName}</TableCell>
                    <TableCell className="text-right">{r.transactions}</TableCell>
                    <TableCell className="text-right font-mono">{r.revenue.toFixed(3)}</TableCell>
                    <TableCell className="text-right">{shift?.shiftsWorked ?? 0}</TableCell>
                    <TableCell className="text-right font-mono">
                      {(shift?.salesPerShift ?? 0).toFixed(3)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 9: Page**

Create `apps/web/src/app/admin/analytics/students-staff/page.tsx`:

```tsx
import {
  getStudentTypeSeries,
  getStudentBreakdown,
  getTopStudentsByLoyalty,
  getTopStudentsBySpend,
} from '@/data/admin/analytics/students'
import { getEmployeeRevenue, getShiftsSummary } from '@/data/admin/analytics/staff'
import { StudentTypeChart } from '@/components/admin/dashboard/student-type-chart'
import { StudentBreakdownCards } from '@/components/admin/analytics/student-breakdown-cards'
import { TopStudentsTable } from '@/components/admin/analytics/top-students-table'
import { EmployeeRevenueTable } from '@/components/admin/analytics/employee-revenue-table'
import { DateRangeFilter } from '@/components/admin/shared/date-range-filter'
import { defaultDateRange } from '@/lib/date-range'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = { searchParams: Promise<{ from?: string; to?: string }> }

export default async function StudentsStaffAnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const defaults = defaultDateRange()
  const from = params.from ?? defaults.from
  const to = params.to ?? defaults.to

  const [studentTypeSeries, breakdown, topLoyalty, topSpend, employeeRevenue, shiftsSummary] =
    await Promise.all([
      getStudentTypeSeries(30),
      getStudentBreakdown(),
      getTopStudentsByLoyalty(),
      getTopStudentsBySpend({ from, to }),
      getEmployeeRevenue({ from, to }),
      getShiftsSummary({ from, to }),
    ])

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Analyse — Étudiants &amp; personnel</h1>
      <DateRangeFilter from={from} to={to} />

      <StudentTypeChart data={studentTypeSeries} />
      <StudentBreakdownCards byUniversity={breakdown.byUniversity} byStudyLevel={breakdown.byStudyLevel} />
      <TopStudentsTable byLoyalty={topLoyalty} bySpend={topSpend} />
      <EmployeeRevenueTable revenue={employeeRevenue} shifts={shiftsSummary} />
    </div>
  )
}
```

- [ ] **Step 10: Typecheck + commit**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep -iE "analytics/students|analytics/staff|students\.ts|staff\.ts"` — expect no output.

```bash
git add apps/web/src/data/admin/analytics/students.ts apps/web/src/data/admin/analytics/staff.ts apps/web/src/data/admin/analytics/staff.test.ts apps/web/src/components/admin/analytics/student-breakdown-cards.tsx apps/web/src/components/admin/analytics/top-students-table.tsx apps/web/src/components/admin/analytics/employee-revenue-table.tsx apps/web/src/app/admin/analytics/students-staff/page.tsx
git commit -m "feat(analytics): add students & staff detail page"
```

---

### Task 5: Link overview KPI tiles/charts to their new detail pages

**Files:**
- Modify: `apps/web/src/app/admin/dashboard/page.tsx`

**Interfaces:** none new — pure JSX edit adding `Link`s now that Task 1–4 routes exist.

- [ ] **Step 1: Add section links**

In `apps/web/src/app/admin/dashboard/page.tsx`, add `import Link from 'next/link'` (already imported) and wrap the revenue-split/cash-flow section header with links, mirroring the KPI section's existing "Voir la comptabilité" link:

```tsx
      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Revenus</h3>
            <Link href="/admin/analytics/subscriptions" className="text-xs font-medium text-primary hover:underline">
              Abonnements →
            </Link>
          </div>
          <RevenueSplitChart data={revenueSplit} />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Trésorerie</h3>
            <Link href="/admin/analytics/pos" className="text-xs font-medium text-primary hover:underline">
              Boutique →
            </Link>
          </div>
          <CashFlowChart data={cashFlow} />
        </div>
      </section>
```

Replace the plain `<section className="grid gap-4 lg:grid-cols-2"><RevenueSplitChart .../><CashFlowChart .../></section>` block from phase 3 with the above.

- [ ] **Step 2: Add links for custom metrics / low stock sections**

```tsx
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground"></h3>
          <Link href="/admin/analytics/students-staff" className="text-xs font-medium text-primary hover:underline">
            Étudiants &amp; personnel →
          </Link>
        </div>
        <CustomMetricsChart metrics={metricsData} />
      </section>

      {snapshot.lowStockProducts.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground"></h3>
            <Link href="/admin/analytics/attendance" className="text-xs font-medium text-primary hover:underline">
              Fréquentation →
            </Link>
          </div>
          <LowStockPanel products={snapshot.lowStockProducts} />
        </section>
      )}
```

- [ ] **Step 3: Typecheck + commit**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep -i dashboard` — expect no output.

```bash
git add apps/web/src/app/admin/dashboard/page.tsx
git commit -m "feat(dashboard): link overview sections to new analytics detail pages"
```

---

## Self-Review Notes

- Spec coverage — Subscriptions: plan popularity ✅, active/expiring/expired counts ✅, revenue per plan ✅, avg discount ✅. POS: best sellers ✅, gross margin ✅ (reused `getProductMargin`), sales by category ✅, low-stock panel ✅ (reused component), restock history ✅. Attendance: current occupancy ✅, peak-hours heatmap ✅ (reused `getPeakHours`), avg session duration ✅, QR vs manual split ✅. Students & staff: new vs recurring ✅ (reused `getStudentTypeSeries`), university/study-level breakdown ✅, top students by loyalty/spend ✅, per-employee revenue & transactions ✅, shifts worked + sales-per-shift ✅ (documented approximation, no shift-level sales FK exists — matches "Deferred (YAGNI)" spirit without inventing schema).
- No new migrations/RPCs — reused `analytics_product_margin`, `analytics_peak_hours` (phase 1) as-is.
- Category "sales by category (drill category → products)" — implemented category rollup only; per-category drill-down interaction deferred (spec says "drill" but page scope here is data + chart; add a click-to-filter interaction later if requested — ponytail: static bar chart per category is the lazy correct read of the requirement, a full drill-down UI is a separate feature).
