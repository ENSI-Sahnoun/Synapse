# Owner Financial Cockpit — Phase 3 (Dashboard overview) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/admin/dashboard` as the overview page — live strip, KPI tiles with period-over-period deltas, summary charts (revenue split, cash-flow), custom-metrics tiles, each block linking to its detail page.

**Architecture:** Add one aggregation function `getOverviewKpis` to `apps/web/src/data/admin/analytics/overview.ts` that reuses phase-2's `getFinanceSummary`/`previousPeriod` (money deltas) plus two small new count queries (active subscriptions, new students) with their own period-over-period deltas. One new `KpiTiles` component renders six tiles with Δ arrows. Page reuses phase-2 chart components (`RevenueSplitChart`, `CashFlowChart`) and phase-1 components (`LiveIndicators`, `CustomMetricsChart`, `LowStockPanel`) via phase-2's `getRevenueSplit`/`getCashFlow` and phase-1's `getLiveSnapshot`/`getCustomMetrics`. Every section gets a `Link` to its detail route.

**Tech Stack:** Next.js App Router server components, Supabase, Recharts, shadcn/ui, `next/link`.

## Global Constraints

- French UI, currency "DT". Reuse existing `.toFixed()` conventions per file (`accounting.ts` money = 3 decimals, `overview.ts`/dashboard components = 2 decimals — keep each file's existing convention, don't unify).
- No new migration, no new RPC — `analytics_cogs` (phase 1) and `getFinanceSummary`/`getRevenueSplit`/`getCashFlow` (phase 2, `apps/web/src/data/admin/accounting.ts`) already cover all money math.
- No new route. Detail routes already exist as links only: `/admin/accounting`, `/admin/analytics/subscriptions`, `/admin/analytics/pos`, `/admin/analytics/attendance`, `/admin/analytics/students-staff` — do NOT build these pages, only link to them (spec: "Detail pages" are separate future work; only `/admin/accounting` currently exists, others are placeholders per spec routing table — confirm existence before linking, see Task 3 Step 1).
- Keep `LiveIndicators` (realtime subscription) as-is — it already satisfies "auto-refresh live strip" more strongly than a 30s poll; do not replace it.
- `export const dynamic = 'force-dynamic'` stays on the page.

---

### Task 1: `getOverviewKpis` data function

**Files:**
- Modify: `apps/web/src/data/admin/analytics/overview.ts` (append)
- Test: `apps/web/src/data/admin/analytics/overview.test.ts` (new)

**Interfaces:**
- Consumes: `getFinanceSummary`, `previousPeriod` from `@/data/admin/accounting` (phase 2, already exported), `createSupabaseClient` (already imported in file).
- Produces:
  ```ts
  export type OverviewKpis = {
    netProfit: number
    netProfitDelta: number
    totalRevenue: number
    totalRevenueDelta: number
    grossMargin: number
    grossMarginDelta: number
    expenses: number
    expensesDelta: number
    activeSubscriptions: number
    activeSubscriptionsDelta: number
    newStudents: number
    newStudentsDelta: number
  }
  export async function getOverviewKpis(range: { from: string; to: string }): Promise<OverviewKpis>
  ```
  Task 2 imports `OverviewKpis` and Task 3 imports `getOverviewKpis`.

- [ ] **Step 1: Write the failing test** for the pure delta-diffing shape (no network) — extract a tiny helper so it's testable without mocking Supabase:

Add to `apps/web/src/data/admin/analytics/overview.ts`:

```ts
export function diffDelta(current: number, previous: number): number {
  return current - previous
}
```

Create `apps/web/src/data/admin/analytics/overview.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { diffDelta } from './overview'

describe('diffDelta', () => {
  it('returns positive delta when current exceeds previous', () => {
    expect(diffDelta(150, 100)).toBe(50)
  })

  it('returns negative delta when current is below previous', () => {
    expect(diffDelta(80, 100)).toBe(-20)
  })

  it('returns zero when unchanged', () => {
    expect(diffDelta(100, 100)).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/data/admin/analytics/overview.test.ts`
Expected: FAIL — `diffDelta` not exported yet (add the export first per Step 1, then this becomes a pass-first sanity check; if already added, run to confirm PASS before continuing).

- [ ] **Step 3: Implement `getOverviewKpis`**

Append to `apps/web/src/data/admin/analytics/overview.ts` (add import at top of file: `import { getFinanceSummary, previousPeriod } from '@/data/admin/accounting'`):

```ts
export type OverviewKpis = {
  netProfit: number
  netProfitDelta: number
  totalRevenue: number
  totalRevenueDelta: number
  grossMargin: number
  grossMarginDelta: number
  expenses: number
  expensesDelta: number
  activeSubscriptions: number
  activeSubscriptionsDelta: number
  newStudents: number
  newStudentsDelta: number
}

async function countActiveSubscriptions(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  asOf: string,
): Promise<number> {
  const { count } = await supabase
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .lte('start_date', asOf)
    .gte('end_date', asOf)
  return count ?? 0
}

async function countNewStudents(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  from: string,
  to: string,
): Promise<number> {
  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'student')
    .gte('created_at', from + 'T00:00:00')
    .lte('created_at', to + 'T23:59:59')
  return count ?? 0
}

export async function getOverviewKpis(range: { from: string; to: string }): Promise<OverviewKpis> {
  const supabase = await createSupabaseClient()
  const prev = previousPeriod(range.from, range.to)

  const [current, previousSummary, activeNow, activePrev, newStudents, newStudentsPrev] =
    await Promise.all([
      getFinanceSummary(range),
      getFinanceSummary(prev),
      countActiveSubscriptions(supabase, range.to),
      countActiveSubscriptions(supabase, prev.to),
      countNewStudents(supabase, range.from, range.to),
      countNewStudents(supabase, prev.from, prev.to),
    ])

  return {
    netProfit: current.netProfit,
    netProfitDelta: current.netProfitDelta,
    totalRevenue: current.revenue,
    totalRevenueDelta: diffDelta(current.revenue, previousSummary.revenue),
    grossMargin: current.grossMargin,
    grossMarginDelta: diffDelta(current.grossMargin, previousSummary.grossMargin),
    expenses: current.expenses,
    expensesDelta: diffDelta(current.expenses, previousSummary.expenses),
    activeSubscriptions: activeNow,
    activeSubscriptionsDelta: diffDelta(activeNow, activePrev),
    newStudents,
    newStudentsDelta: diffDelta(newStudents, newStudentsPrev),
  }
}
```

Note: `current.netProfitDelta` already compares vs `previousPeriod` internally inside `getFinanceSummary` — reused as-is, no recomputation.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/data/admin/analytics/overview.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/data/admin/analytics/overview.ts apps/web/src/data/admin/analytics/overview.test.ts
git commit -m "feat(dashboard): add getOverviewKpis with period-over-period deltas"
```

---

### Task 2: `KpiTiles` component

**Files:**
- Create: `apps/web/src/components/admin/dashboard/kpi-tiles.tsx`

**Interfaces:**
- Consumes: `OverviewKpis` from `@/data/admin/analytics/overview` (Task 1).
- Produces: `KpiTiles` component, imported by page in Task 3.

- [ ] **Step 1: Write component**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { OverviewKpis } from '@/data/admin/analytics/overview'

type Props = { kpis: OverviewKpis }

function DeltaBadge({ value, unit }: { value: number; unit: string }) {
  const positive = value >= 0
  return (
    <span className={`text-xs font-medium ${positive ? 'text-green-600' : 'text-red-600'}`}>
      {positive ? '▲' : '▼'} {Math.abs(value).toFixed(unit === 'DT' ? 3 : 0)}
      {unit === 'DT' ? ' DT' : ''}
    </span>
  )
}

export function KpiTiles({ kpis }: Props) {
  const tiles = [
    { label: 'Bénéfice net', value: `${kpis.netProfit.toFixed(3)} DT`, delta: kpis.netProfitDelta, unit: 'DT' },
    { label: 'Revenus totaux', value: `${kpis.totalRevenue.toFixed(3)} DT`, delta: kpis.totalRevenueDelta, unit: 'DT' },
    { label: 'Marge brute', value: `${kpis.grossMargin.toFixed(3)} DT`, delta: kpis.grossMarginDelta, unit: 'DT' },
    { label: 'Abonnements actifs', value: kpis.activeSubscriptions.toString(), delta: kpis.activeSubscriptionsDelta, unit: 'count' },
    { label: 'Nouveaux étudiants', value: kpis.newStudents.toString(), delta: kpis.newStudentsDelta, unit: 'count' },
    { label: 'Dépenses', value: `${kpis.expenses.toFixed(3)} DT`, delta: kpis.expensesDelta, unit: 'DT' },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <Card key={t.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-xl font-bold">{t.value}</p>
            <DeltaBadge value={t.delta} unit={t.unit} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/admin/dashboard/kpi-tiles.tsx
git commit -m "feat(dashboard): add KPI tiles with period-over-period deltas"
```

---

### Task 3: Rebuild `/admin/dashboard` page as overview with detail links

**Files:**
- Modify: `apps/web/src/app/admin/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getLiveSnapshot`, `getCustomMetrics` (phase 1, `@/data/admin/analytics/overview`), `getOverviewKpis` (Task 1), `getRevenueSplit`, `getCashFlow` (phase 2, `@/data/admin/accounting`), `KpiTiles` (Task 2), `LiveIndicators`, `CustomMetricsChart`, `LowStockPanel` (phase 1, existing components), `RevenueSplitChart`, `CashFlowChart` (phase 2, existing components).

- [ ] **Step 1: Confirm which detail routes actually exist**

Run: `find apps/web/src/app/admin/analytics -maxdepth 1 -type d 2>/dev/null; ls apps/web/src/app/admin/accounting`

If `apps/web/src/app/admin/analytics/*` subfolders don't exist yet (expected — spec defers them to a later phase), link only to `/admin/accounting` for the finance blocks, and omit links for subscriptions/pos/attendance/students-staff sections since those source charts (`PlanPieChart`, `StudentTypeChart`) don't have a detail page yet — keep them on the overview unlinked, as today.

- [ ] **Step 2: Replace page contents**

Full new content for `apps/web/src/app/admin/dashboard/page.tsx`:

```tsx
import Link from 'next/link'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getLiveSnapshot,
  getCustomMetrics,
  getOverviewKpis,
} from '@/data/admin/analytics/overview'
import { getRevenueSplit, getCashFlow } from '@/data/admin/accounting'
import { LiveIndicators } from '@/components/admin/dashboard/live-indicators'
import { KpiTiles } from '@/components/admin/dashboard/kpi-tiles'
import { RevenueSplitChart } from '@/components/admin/accounting/revenue-split-chart'
import { CashFlowChart } from '@/components/admin/accounting/cash-flow-chart'
import { CustomMetricsChart } from '@/components/admin/dashboard/custom-metrics-chart'
import { LowStockPanel } from '@/components/admin/dashboard/low-stock-panel'
import { defaultDateRange } from '@/lib/date-range'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminDashboardPage() {
  const { from, to } = defaultDateRange()

  const [snapshot, metricsData, kpis, revenueSplit, cashFlow] = await Promise.all([
    getLiveSnapshot(),
    getCustomMetrics(),
    getOverviewKpis({ from, to }),
    getRevenueSplit({ from, to }),
    getCashFlow({ from, to }),
  ])

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          En direct
        </h2>
        <Suspense fallback={<Skeleton className="h-28 w-full" />}>
          <LiveIndicators initial={snapshot} />
        </Suspense>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Indicateurs clés — ce mois
          </h2>
          <Link href="/admin/accounting" className="text-sm font-medium text-primary hover:underline">
            Voir la comptabilité →
          </Link>
        </div>
        <KpiTiles kpis={kpis} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <RevenueSplitChart data={revenueSplit} />
        <CashFlowChart data={cashFlow} />
      </section>

      <section>
        <CustomMetricsChart metrics={metricsData} />
      </section>

      {snapshot.lowStockProducts.length > 0 && (
        <section>
          <LowStockPanel products={snapshot.lowStockProducts} />
        </section>
      )}
    </div>
  )
}
```

Note: `getDailySummary`, `getRevenueOverTime`, `getStudentTypeSeries`, `getPlanPopularity` and their chart components (`DailySummaryCards`, `RevenueChart`, `StudentTypeChart`, `PlanPieChart`) are superseded on the overview by `KpiTiles`/`RevenueSplitChart`/`CashFlowChart` per spec section "Overview" ("KPI tiles ... Summary charts: revenue over time (stacked subs vs POS), net cash-flow line"). Do not delete those data functions or components — they remain used by other pages/future detail pages (`students-staff`, `subscriptions`) per spec; only the dashboard page stops importing them.

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors (confirms no dangling imports of removed dashboard-page usages elsewhere)

- [ ] **Step 4: Manual verification**

Start dev server, log in as admin, open `/admin/dashboard`: confirm live strip renders, KPI tiles show 6 tiles with Δ arrows, revenue-split + cash-flow charts render, custom metrics section renders (or is empty gracefully), low-stock panel shows only if products are low, "Voir la comptabilité" link navigates to `/admin/accounting`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/admin/dashboard/page.tsx
git commit -m "feat(dashboard): rebuild overview with KPI tiles, revenue split and cash-flow, detail links"
```

---

## Self-Review Notes

- Spec coverage: live strip ✅ (kept `LiveIndicators`), KPI tiles with Δ ✅ (Task 1+2: net profit, revenue, gross margin, active subs, new students, expenses — all six named in spec), summary charts (revenue split stacked + cash-flow) ✅ (Task 3, reused phase-2 components), custom metrics tiles ✅ (kept `CustomMetricsChart`), links to detail pages ✅ (accounting link added; other detail routes don't exist yet per spec phasing, so not linked — avoids dead links).
- Reuse: zero new migrations/RPCs; `getFinanceSummary`, `previousPeriod`, `getRevenueSplit`, `getCashFlow` (phase 2) and `getLiveSnapshot`, `getCustomMetrics` (phase 1) all reused as-is.
- No unrequested abstractions: `KpiTiles` is one flat component, no per-tile factory.
