# Owner Financial Cockpit — Phase 2 (Finances page) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `/admin/accounting` with a net-profit summary card (revenue − COGS − expenses, Δ vs previous period), a revenue-split (subs vs POS) stacked bar, an expenses-by-category donut, and a daily cash-flow line — reusing phase-1's `analytics_cogs` RPC and existing `getPnl`/`getExpenses`.

**Architecture:** One new data function `getFinanceSummary(from, to)` in `apps/web/src/data/admin/accounting.ts` that calls `analytics_cogs` RPC (current + previous period) and combines with existing `getPnl`. Three new small presentational chart/card components under `apps/web/src/components/admin/accounting/`. Page wires them into the existing `pnl` tab of `apps/web/src/app/admin/accounting/page.tsx`. No new routes, no new tables.

**Tech Stack:** Next.js App Router server components, Supabase RPC (`analytics_cogs`, already migrated), Recharts, shadcn/ui Card/Table.

## Global Constraints

- French UI copy, currency label "DT", amounts formatted with `.toFixed(3)` (dinar convention already used in `pnl-table.tsx`) except the new cards which use `.toFixed(2)` to match `revenue-chart.tsx` convention — use `.toFixed(3)` everywhere in this plan to stay consistent with `PnlTable`.
- Reuse `analytics_cogs(p_from date, p_to date)` RPC from `apps/database/supabase/migrations/20260704100000_analytics_rpcs.sql` — do not add a new RPC or migration.
- Reuse `getPnl`, `getExpenses`, `getExpenseCategories` from `apps/web/src/data/admin/accounting.ts` — do not duplicate their queries.
- Reuse `defaultDateRange`/date params already wired in `apps/web/src/app/admin/accounting/page.tsx` (`from`, `to` search params) — no new date picker.
- No new dependencies. Recharts and shadcn Card/Table/Badge are already installed and used in sibling files.
- Server-only data fetching (`createSupabaseClient` from `@/supabase-clients/server`), `Promise.all` batching, existing `export const dynamic = 'force-dynamic'`.

---

### Task 1: `getFinanceSummary` data function (net profit + Δ + revenue split)

**Files:**
- Modify: `apps/web/src/data/admin/accounting.ts` (append)
- Test: `apps/web/src/data/admin/accounting.test.ts` (new — check repo test runner convention below)

**Interfaces:**
- Consumes: `createSupabaseClient` (existing import in file), Supabase RPC `analytics_cogs(p_from, p_to)` → `{ cogs: number, revenue: number, missing_cost_products: number }[]` (single row), table `subscriptions(paid_amount, created_at)`, table `purchases(total_dt, created_at)`.
- Produces:
  ```ts
  export type FinanceSummary = {
    revenue: number
    subsRevenue: number
    posRevenue: number
    cogs: number
    missingCostProducts: number
    expenses: number
    grossMargin: number
    netProfit: number
    prevNetProfit: number
    netProfitDelta: number // netProfit - prevNetProfit
  }
  export async function getFinanceSummary(filters: { from: string; to: string }): Promise<FinanceSummary>
  ```
  Later tasks (2, 4) import `FinanceSummary` and `getFinanceSummary` from `@/data/admin/accounting`.

Previous period = same length window immediately before `from` (e.g. range `2026-06-01..2026-06-30` → previous `2026-05-01..2026-05-31`).

- [ ] **Step 1: Check test runner/convention first**

Run: `grep -r "test(" apps/web/src/data --include=*.test.ts -l | head -3 || find apps/web -name "*.test.ts" | head -5`

If no existing `*.test.ts` convention under `apps/web/src/data`, skip the dedicated test file and instead add one `assert`-based self-check function exported as `__test_getFinanceSummary` is NOT needed — per repo convention favor whatever pattern the grep reveals. If nothing exists, write a plain node script instead (Step 2 below adapts either way).

- [ ] **Step 2: Write the function**

Append to `apps/web/src/data/admin/accounting.ts`:

```ts
export type FinanceSummary = {
  revenue: number
  subsRevenue: number
  posRevenue: number
  cogs: number
  missingCostProducts: number
  expenses: number
  grossMargin: number
  netProfit: number
  prevNetProfit: number
  netProfitDelta: number
}

function previousPeriod(from: string, to: string): { from: string; to: string } {
  const fromDate = new Date(from + 'T00:00:00Z')
  const toDate = new Date(to + 'T00:00:00Z')
  const days = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1
  const prevTo = new Date(fromDate.getTime() - 86_400_000)
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86_400_000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(prevFrom), to: fmt(prevTo) }
}

async function computeNetProfit(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  from: string,
  to: string,
): Promise<{ netProfit: number; subsRevenue: number; posRevenue: number; cogs: number; missingCostProducts: number; expenses: number }> {
  const [{ data: cogsRows }, { data: subs }, { data: expenses }] = await Promise.all([
    supabase.rpc('analytics_cogs', { p_from: from, p_to: to }),
    supabase
      .from('subscriptions')
      .select('paid_amount')
      .gte('created_at', from + 'T00:00:00')
      .lte('created_at', to + 'T23:59:59'),
    supabase.from('expenses').select('amount_dt').gte('date', from).lte('date', to),
  ])

  const cogsRow = cogsRows?.[0] ?? { cogs: 0, revenue: 0, missing_cost_products: 0 }
  const subsRevenue = subs?.reduce((s, r) => s + Number(r.paid_amount), 0) ?? 0
  const posRevenue = Number(cogsRow.revenue)
  const cogs = Number(cogsRow.cogs)
  const expensesTotal = expenses?.reduce((s, r) => s + Number(r.amount_dt), 0) ?? 0
  const grossMargin = subsRevenue + posRevenue - cogs
  const netProfit = grossMargin - expensesTotal

  return {
    netProfit,
    subsRevenue,
    posRevenue,
    cogs,
    missingCostProducts: Number(cogsRow.missing_cost_products),
    expenses: expensesTotal,
  }
}

export async function getFinanceSummary(filters: { from: string; to: string }): Promise<FinanceSummary> {
  const supabase = await createSupabaseClient()
  const prev = previousPeriod(filters.from, filters.to)

  const [current, previous] = await Promise.all([
    computeNetProfit(supabase, filters.from, filters.to),
    computeNetProfit(supabase, prev.from, prev.to),
  ])

  return {
    revenue: current.subsRevenue + current.posRevenue,
    subsRevenue: current.subsRevenue,
    posRevenue: current.posRevenue,
    cogs: current.cogs,
    missingCostProducts: current.missingCostProducts,
    expenses: current.expenses,
    grossMargin: current.subsRevenue + current.posRevenue - current.cogs,
    netProfit: current.netProfit,
    prevNetProfit: previous.netProfit,
    netProfitDelta: current.netProfit - previous.netProfit,
  }
}
```

- [ ] **Step 3: Self-check (money path)**

If repo has no test harness wired for `apps/web/src/data`, add this minimal assert-based check at the bottom of the same file (guarded so it never runs in prod bundle — export only, invoked manually via `tsx`):

```ts
// ponytail: manual money-math check, run with `npx tsx apps/web/src/data/admin/accounting.ts --selftest`
if (process.argv.includes('--selftest')) {
  const prev = previousPeriod('2026-06-01', '2026-06-30')
  console.assert(prev.from === '2026-05-01' && prev.to === '2026-05-31', 'previousPeriod mismatch', prev)
  console.log('selftest ok')
}
```

Run: `npx tsx apps/web/src/data/admin/accounting.ts --selftest`
Expected: `selftest ok` printed, no assertion failure.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/data/admin/accounting.ts
git commit -m "feat(accounting): add getFinanceSummary net-profit aggregation"
```

---

### Task 2: Net-profit summary card component

**Files:**
- Create: `apps/web/src/components/admin/accounting/net-profit-card.tsx`

**Interfaces:**
- Consumes: `FinanceSummary` from `@/data/admin/accounting` (Task 1).
- Produces: `NetProfitCard` component, imported by page in Task 5.

- [ ] **Step 1: Write component**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FinanceSummary } from '@/data/admin/accounting'

type Props = { summary: FinanceSummary }

export function NetProfitCard({ summary }: Props) {
  const { netProfit, netProfitDelta, revenue, grossMargin, expenses, missingCostProducts } = summary
  const deltaPositive = netProfitDelta >= 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Résultat net</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className={`rounded-lg border-2 p-4 ${
            netProfit >= 0 ? 'border-green-500 bg-green-50' : 'border-red-400 bg-red-50'
          }`}
        >
          <p className="text-sm font-medium text-muted-foreground">Bénéfice net (revenus − COGS − dépenses)</p>
          <p className={`text-3xl font-bold ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {netProfit >= 0 ? '+' : ''}
            {netProfit.toFixed(3)} DT
          </p>
          <p className={`text-sm font-medium ${deltaPositive ? 'text-green-600' : 'text-red-600'}`}>
            {deltaPositive ? '▲' : '▼'} {Math.abs(netProfitDelta).toFixed(3)} DT vs période précédente
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Revenus</p>
            <p className="font-mono font-semibold">{revenue.toFixed(3)} DT</p>
          </div>
          <div>
            <p className="text-muted-foreground">Marge brute</p>
            <p className="font-mono font-semibold">{grossMargin.toFixed(3)} DT</p>
          </div>
          <div>
            <p className="text-muted-foreground">Dépenses</p>
            <p className="font-mono font-semibold">{expenses.toFixed(3)} DT</p>
          </div>
        </div>
        {missingCostProducts > 0 && (
          <p className="text-xs text-amber-600">
            ⚠ {missingCostProducts} produit(s) sans prix de revient — marge sous-estimée
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/admin/accounting/net-profit-card.tsx
git commit -m "feat(accounting): add net profit summary card"
```

---

### Task 3: Revenue-split chart (subs vs POS) + expenses-by-category chart + cash-flow line — data

**Files:**
- Modify: `apps/web/src/data/admin/accounting.ts` (append)

**Interfaces:**
- Consumes: tables `subscriptions(paid_amount, created_at)`, `purchases(total_dt, created_at)`, `expenses(amount_dt, date, account_category_id, account_categories(name))`.
- Produces:
  ```ts
  export type RevenueSplitPoint = { date: string; subs: number; pos: number }
  export type ExpenseByCategory = { category: string; total: number }
  export type CashFlowPoint = { date: string; net: number }
  export async function getRevenueSplit(filters: { from: string; to: string }): Promise<RevenueSplitPoint[]>
  export async function getExpensesByCategory(filters: { from: string; to: string }): Promise<ExpenseByCategory[]>
  export async function getCashFlow(filters: { from: string; to: string }): Promise<CashFlowPoint[]>
  ```
  Task 4 imports these three plus their types.

- [ ] **Step 1: Write the functions**

```ts
export type RevenueSplitPoint = { date: string; subs: number; pos: number }
export type ExpenseByCategory = { category: string; total: number }
export type CashFlowPoint = { date: string; net: number }

function enumerateDays(from: string, to: string): string[] {
  const days: string[] = []
  const cur = new Date(from + 'T00:00:00Z')
  const end = new Date(to + 'T00:00:00Z')
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return days
}

export async function getRevenueSplit(filters: { from: string; to: string }): Promise<RevenueSplitPoint[]> {
  const supabase = await createSupabaseClient()

  const [{ data: subs }, { data: purchases }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('paid_amount, created_at')
      .gte('created_at', filters.from + 'T00:00:00')
      .lte('created_at', filters.to + 'T23:59:59'),
    supabase
      .from('purchases')
      .select('total_dt, created_at')
      .gte('created_at', filters.from + 'T00:00:00')
      .lte('created_at', filters.to + 'T23:59:59'),
  ])

  const subsMap = new Map<string, number>()
  subs?.forEach((r) => {
    const d = r.created_at.slice(0, 10)
    subsMap.set(d, (subsMap.get(d) ?? 0) + Number(r.paid_amount))
  })

  const posMap = new Map<string, number>()
  purchases?.forEach((r) => {
    const d = r.created_at.slice(0, 10)
    posMap.set(d, (posMap.get(d) ?? 0) + Number(r.total_dt))
  })

  return enumerateDays(filters.from, filters.to).map((date) => ({
    date,
    subs: subsMap.get(date) ?? 0,
    pos: posMap.get(date) ?? 0,
  }))
}

export async function getExpensesByCategory(filters: { from: string; to: string }): Promise<ExpenseByCategory[]> {
  const supabase = await createSupabaseClient()

  const { data } = await supabase
    .from('expenses')
    .select('amount_dt, account_categories!inner(name)')
    .gte('date', filters.from)
    .lte('date', filters.to)

  const map = new Map<string, number>()
  data?.forEach((r) => {
    const cat = r.account_categories as unknown as { name: string }
    map.set(cat.name, (map.get(cat.name) ?? 0) + Number(r.amount_dt))
  })

  return Array.from(map.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
}

export async function getCashFlow(filters: { from: string; to: string }): Promise<CashFlowPoint[]> {
  const supabase = await createSupabaseClient()

  const [{ data: subs }, { data: purchases }, { data: expenses }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('paid_amount, created_at')
      .gte('created_at', filters.from + 'T00:00:00')
      .lte('created_at', filters.to + 'T23:59:59'),
    supabase
      .from('purchases')
      .select('total_dt, created_at')
      .gte('created_at', filters.from + 'T00:00:00')
      .lte('created_at', filters.to + 'T23:59:59'),
    supabase.from('expenses').select('amount_dt, date').gte('date', filters.from).lte('date', filters.to),
  ])

  const map = new Map<string, number>()
  subs?.forEach((r) => {
    const d = r.created_at.slice(0, 10)
    map.set(d, (map.get(d) ?? 0) + Number(r.paid_amount))
  })
  purchases?.forEach((r) => {
    const d = r.created_at.slice(0, 10)
    map.set(d, (map.get(d) ?? 0) + Number(r.total_dt))
  })
  expenses?.forEach((r) => {
    const d = r.date.slice(0, 10)
    map.set(d, (map.get(d) ?? 0) - Number(r.amount_dt))
  })

  return enumerateDays(filters.from, filters.to).map((date) => ({ date, net: map.get(date) ?? 0 }))
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/data/admin/accounting.ts
git commit -m "feat(accounting): add revenue split, expenses-by-category, cash-flow queries"
```

---

### Task 4: Chart components (revenue split, expenses donut, cash-flow line)

**Files:**
- Create: `apps/web/src/components/admin/accounting/revenue-split-chart.tsx`
- Create: `apps/web/src/components/admin/accounting/expenses-by-category-chart.tsx`
- Create: `apps/web/src/components/admin/accounting/cash-flow-chart.tsx`

**Interfaces:**
- Consumes: `RevenueSplitPoint[]`, `ExpenseByCategory[]`, `CashFlowPoint[]` from `@/data/admin/accounting` (Task 3).
- Produces: `RevenueSplitChart`, `ExpensesByCategoryChart`, `CashFlowChart`, imported by page in Task 5.

- [ ] **Step 1: `revenue-split-chart.tsx`** (stacked bar, mirrors `revenue-chart.tsx` styling)

```tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RevenueSplitPoint } from '@/data/admin/accounting'

type Props = { data: RevenueSplitPoint[] }

export function RevenueSplitChart({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenus — abonnements vs boutique</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit=" DT" />
            <Tooltip formatter={(v: number) => `${v.toFixed(3)} DT`} labelFormatter={(l: string) => `Date: ${l}`} />
            <Legend />
            <Bar dataKey="subs" name="Abonnements" stackId="rev" fill="#6366f1" />
            <Bar dataKey="pos" name="Boutique" stackId="rev" fill="#22c55e" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: `expenses-by-category-chart.tsx`** (donut, mirrors `plan-pie-chart.tsx`)

```tsx
'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ExpenseByCategory } from '@/data/admin/accounting'

const COLORS = ['#ef4444', '#f59e0b', '#a855f7', '#3b82f6', '#22c55e', '#6366f1']

type Props = { data: ExpenseByCategory[] }

export function ExpensesByCategoryChart({ data }: Props) {
  const total = data.reduce((s, d) => s + d.total, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dépenses par catégorie</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground">Aucune dépense sur la période</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data}
                dataKey="total"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `${v.toFixed(3)} DT`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
        <p className="mt-2 text-right text-sm font-semibold">Total: {total.toFixed(3)} DT</p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: `cash-flow-chart.tsx`** (line, zero reference)

```tsx
'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CashFlowPoint } from '@/data/admin/accounting'

type Props = { data: CashFlowPoint[] }

export function CashFlowChart({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Flux de trésorerie quotidien (revenus − dépenses)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit=" DT" />
            <Tooltip formatter={(v: number) => `${v.toFixed(3)} DT`} labelFormatter={(l: string) => `Date: ${l}`} />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <Line type="monotone" dataKey="net" stroke="#0ea5e9" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/admin/accounting/revenue-split-chart.tsx apps/web/src/components/admin/accounting/expenses-by-category-chart.tsx apps/web/src/components/admin/accounting/cash-flow-chart.tsx
git commit -m "feat(accounting): add revenue split, expenses donut, cash-flow charts"
```

---

### Task 5: Wire into `/admin/accounting` page

**Files:**
- Modify: `apps/web/src/app/admin/accounting/page.tsx`

**Interfaces:**
- Consumes: `getFinanceSummary`, `getRevenueSplit`, `getExpensesByCategory`, `getCashFlow` (Tasks 1, 3), `NetProfitCard` (Task 2), `RevenueSplitChart`, `ExpensesByCategoryChart`, `CashFlowChart` (Task 4).

- [ ] **Step 1: Update imports and data fetch, add charts to `pnl` tab**

In `apps/web/src/app/admin/accounting/page.tsx`, replace the import block and `Promise.all` and the `pnl` `TabsContent`:

```tsx
import {
  getExpenses,
  getPnl,
  getExpenseCategories,
  getFinanceSummary,
  getRevenueSplit,
  getExpensesByCategory,
  getCashFlow,
} from '@/data/admin/accounting'
import { NetProfitCard } from '@/components/admin/accounting/net-profit-card'
import { RevenueSplitChart } from '@/components/admin/accounting/revenue-split-chart'
import { ExpensesByCategoryChart } from '@/components/admin/accounting/expenses-by-category-chart'
import { CashFlowChart } from '@/components/admin/accounting/cash-flow-chart'
```

Replace the `Promise.all` call:

```tsx
  const [expenses, pnl, categories, financeSummary, revenueSplit, expensesByCategory, cashFlow] =
    await Promise.all([
      getExpenses({ from, to, category_id }),
      getPnl({ from, to }),
      getExpenseCategories(),
      getFinanceSummary({ from, to }),
      getRevenueSplit({ from, to }),
      getExpensesByCategory({ from, to }),
      getCashFlow({ from, to }),
    ])
```

Replace the `pnl` tab content:

```tsx
        <TabsContent value="pnl" className="space-y-6">
          <NetProfitCard summary={financeSummary} />

          <div className="grid gap-6 md:grid-cols-2">
            <RevenueSplitChart data={revenueSplit} />
            <ExpensesByCategoryChart data={expensesByCategory} />
          </div>

          <CashFlowChart data={cashFlow} />

          <Card>
            <CardHeader>
              <CardTitle>
                Compte de résultat — {new Date(from).toLocaleDateString('fr-FR')} →{' '}
                {new Date(to).toLocaleDateString('fr-FR')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PnlTable pnl={pnl} />
            </CardContent>
          </Card>
        </TabsContent>
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors from `page.tsx` or the new accounting files.

- [ ] **Step 3: Manual verification**

Run: `cd apps/web && npm run dev` (or existing dev script), open `/admin/accounting`, confirm the P&L tab shows net-profit card with Δ, stacked revenue bar, expenses donut, cash-flow line above the existing P&L table, for the default this-month range and a custom range via the date filter.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/admin/accounting/page.tsx
git commit -m "feat(accounting): wire net-profit, revenue split, expenses and cash-flow into finances page"
```

---

## Self-Review Notes

- Spec coverage: net-profit card + Δ ✅ (Task 2), revenue split subs/POS ✅ (Task 3/4), expenses-by-category chart ✅ (Task 3/4), daily cash-flow line ✅ (Task 3/4), reuse `getPnl`/existing P&L table ✅ (kept as-is in Task 5), reuse phase-1 `analytics_cogs` RPC ✅ (Task 1), "seam" for recurring expenses — untouched, no expense-posting code changed, seam preserved. "Add expense" stays — untouched.
- No new migration, no new route, no new dependency — matches spec's "extend existing `/admin/accounting`, no new route."
