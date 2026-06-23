# Phase 7A: Admin Dashboard — Live Indicators + Charts

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/admin/dashboard` placeholder with a fully live admin dashboard featuring Supabase Realtime occupancy indicators, daily KPI cards, and Recharts visualisations (line, bar, pie, custom metric target lines).

**Architecture:** The page is a React Server Component that fetches initial snapshot data via Supabase server client, then mounts lightweight Client Components that subscribe to Realtime channels for live seat/attendance/purchase updates. Charts are pure client components using Recharts, hydrated with server-fetched historical data passed as props. Custom metrics are loaded from the `custom_metrics` table and rendered with a `ReferenceLine` target overlay.

**Tech Stack:** Next.js 16 RSC, Supabase Realtime, recharts, shadcn/ui (Card, Badge, Skeleton), date-fns, next-safe-action

## Global Constraints

- Route: `apps/web/src/app/(app-pages)/admin/dashboard/page.tsx` (replace placeholder)
- Admin-only — middleware already guards `(app-pages)/admin/`; add an extra `adminActionClient` check on any server actions used here
- French labels everywhere — no English strings in UI
- Realtime subscriptions opened in Client Components only — never in RSC
- recharts components must be wrapped in `'use client'` files
- No hardcoded category IDs — always join through `account_categories`
- Migration naming: timestamps starting at `20260623500000`
- All commands run from `/home/sah/Synapse`

---

### Task 1: Database migration — dashboard helper views + custom_metrics table

**Files:**
- Create: `apps/database/supabase/migrations/20260623500000_phase7_custom_metrics.sql`

- [ ] **Step 1: Write migration**

```sql
-- apps/database/supabase/migrations/20260623500000_phase7_custom_metrics.sql

-- Custom metrics table (may already exist from earlier phases; use IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.custom_metrics (
  id                   uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name                 text        NOT NULL,
  unit                 text        NOT NULL DEFAULT '',
  target_value         numeric,
  is_dashboard_visible boolean     NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_metrics_select" ON public.custom_metrics
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "custom_metrics_write" ON public.custom_metrics
  FOR ALL USING (public.current_user_role() = 'admin');

-- expenses table (may already exist)
CREATE TABLE IF NOT EXISTS public.expenses (
  id                  uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_category_id uuid        NOT NULL REFERENCES public.account_categories(id),
  description         text        NOT NULL DEFAULT '',
  amount_dt           numeric     NOT NULL CHECK (amount_dt >= 0),
  date                date        NOT NULL DEFAULT CURRENT_DATE,
  created_by          uuid        NOT NULL REFERENCES public.profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select" ON public.expenses
  FOR SELECT USING (public.current_user_role() = 'admin');

CREATE POLICY "expenses_insert" ON public.expenses
  FOR INSERT WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "expenses_update" ON public.expenses
  FOR UPDATE USING (public.current_user_role() = 'admin');

CREATE POLICY "expenses_delete" ON public.expenses
  FOR DELETE USING (public.current_user_role() = 'admin');

-- Seed a few custom metrics for demo
INSERT INTO public.custom_metrics (name, unit, target_value, is_dashboard_visible) VALUES
  ('Nouveaux étudiants ce mois', 'étudiants', 50, true),
  ('Chiffre d''affaires mensuel', 'DT', 3000, true)
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Apply migration**

```bash
cd apps/database && pnpm supabase db reset
```

Expected: `Finished supabase db reset`.

- [ ] **Step 3: Regenerate types**

```bash
cd /home/sah/Synapse && pnpm gen-types-local
```

Expected: `apps/web/src/lib/database.types.ts` updated with `custom_metrics` and `expenses`.

- [ ] **Step 4: Commit**

```bash
git add apps/database/supabase/migrations/20260623500000_phase7_custom_metrics.sql \
        apps/web/src/lib/database.types.ts
git commit -m "feat(db): add custom_metrics and expenses tables for Phase 7"
```

---

### Task 2: Server-side data fetching layer

**Files:**
- Create: `apps/web/src/data/admin/dashboard.ts`

- [ ] **Step 1: Write dashboard data functions**

```typescript
// apps/web/src/data/admin/dashboard.ts
import { createSupabaseServerClient } from '@/supabase-clients/server'

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

const today = () => new Date().toISOString().slice(0, 10)

export async function getLiveSnapshot(): Promise<LiveSnapshot> {
  const supabase = await createSupabaseServerClient()

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
    .lt('created_at', todayStr + 'T23:59:59')

  const { data: purchaseRevenue } = await supabase
    .from('purchases')
    .select('total_dt')
    .gte('created_at', todayStr + 'T00:00:00')
    .lt('created_at', todayStr + 'T23:59:59')

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
  const supabase = await createSupabaseServerClient()
  const todayStr = today()
  const start = todayStr + 'T00:00:00'
  const end = todayStr + 'T23:59:59'

  const { count: newStudents } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'student')
    .gte('created_at', start)
    .lte('created_at', end)

  const { data: subs } = await supabase
    .from('subscriptions')
    .select('paid_amount')
    .gte('created_at', start)
    .lte('created_at', end)

  const subscriptionsSold = subs?.length ?? 0
  const subscriptionsRevenue = subs?.reduce((s, r) => s + Number(r.paid_amount), 0) ?? 0

  const { data: purchases } = await supabase
    .from('purchases')
    .select('total_dt')
    .gte('created_at', start)
    .lte('created_at', end)

  const inStoreSales = purchases?.reduce((s, r) => s + Number(r.total_dt), 0) ?? 0

  const { count: footfall } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .gte('checked_in_at', start)
    .lte('checked_in_at', end)

  return {
    newStudents: newStudents ?? 0,
    subscriptionsSold,
    subscriptionsRevenue,
    inStoreSales,
    footfall: footfall ?? 0,
  }
}

export async function getRevenueOverTime(days = 30): Promise<RevenuePoint[]> {
  const supabase = await createSupabaseServerClient()
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
  const supabase = await createSupabaseServerClient()
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
  const supabase = await createSupabaseServerClient()
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
  const supabase = await createSupabaseServerClient()
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/data/admin/dashboard.ts
git commit -m "feat(admin): dashboard data fetching layer"
```

---

### Task 3: Live indicator Client Component (Realtime)

**Files:**
- Create: `apps/web/src/components/admin/dashboard/live-indicators.tsx`

- [ ] **Step 1: Write live indicators component**

```typescript
// apps/web/src/components/admin/dashboard/live-indicators.tsx
'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/supabase-clients/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { LiveSnapshot } from '@/data/admin/dashboard'

type Props = {
  initial: LiveSnapshot
}

export function LiveIndicators({ initial }: Props) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot>(initial)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()

    // Re-fetch live snapshot on any relevant change
    async function refresh() {
      // Fetch updated counts from API route to avoid RLS issues in browser client
      const res = await fetch('/api/admin/dashboard/snapshot')
      if (res.ok) {
        const data = await res.json()
        setSnapshot(data)
      }
    }

    const channel = supabase
      .channel('dashboard-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'seats' },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'purchases' },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'subscriptions' },
        refresh,
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const occupancyPct =
    snapshot.seatOccupancy.total > 0
      ? Math.round((snapshot.seatOccupancy.occupied / snapshot.seatOccupancy.total) * 100)
      : 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Étudiants présents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{snapshot.studentsInside}</p>
          <Badge variant="outline" className="mt-1">
            En direct
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Occupation des places
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            {snapshot.seatOccupancy.occupied}/{snapshot.seatOccupancy.total}
          </p>
          <p className="text-sm text-muted-foreground">{occupancyPct}% occupé</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Revenus du jour
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{snapshot.todayRevenue.toFixed(2)} DT</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Abonnements expirant cette semaine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{snapshot.expiringSoonCount}</p>
          {snapshot.expiringSoonCount > 0 && (
            <Badge variant="destructive" className="mt-1">
              Attention
            </Badge>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Write API route that powers the Realtime refresh**

```typescript
// apps/web/src/app/api/admin/dashboard/snapshot/route.ts
import { NextResponse } from 'next/server'
import { getLiveSnapshot } from '@/data/admin/dashboard'
import { createSupabaseServerClient } from '@/supabase-clients/server'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin')
    return NextResponse.json({ error: 'Accès réservé aux admins' }, { status: 403 })

  const snapshot = await getLiveSnapshot()
  return NextResponse.json(snapshot)
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/admin/dashboard/live-indicators.tsx \
        apps/web/src/app/api/admin/dashboard/snapshot/route.ts
git commit -m "feat(admin): live dashboard indicators with Supabase Realtime"
```

---

### Task 4: KPI summary cards

**Files:**
- Create: `apps/web/src/components/admin/dashboard/daily-summary.tsx`

- [ ] **Step 1: Write component**

```typescript
// apps/web/src/components/admin/dashboard/daily-summary.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DailySummary } from '@/data/admin/dashboard'

type Props = { summary: DailySummary }

export function DailySummaryCards({ summary }: Props) {
  const cards = [
    { label: 'Nouveaux étudiants', value: summary.newStudents.toString() },
    {
      label: 'Abonnements vendus',
      value: `${summary.subscriptionsSold} — ${summary.subscriptionsRevenue.toFixed(2)} DT`,
    },
    { label: 'Ventes en magasin', value: `${summary.inStoreSales.toFixed(2)} DT` },
    { label: 'Fréquentation totale', value: summary.footfall.toString() },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/admin/dashboard/daily-summary.tsx
git commit -m "feat(admin): daily summary KPI cards"
```

---

### Task 5: Chart components (Recharts)

**Files:**
- Create: `apps/web/src/components/admin/dashboard/revenue-chart.tsx`
- Create: `apps/web/src/components/admin/dashboard/student-type-chart.tsx`
- Create: `apps/web/src/components/admin/dashboard/plan-pie-chart.tsx`
- Create: `apps/web/src/components/admin/dashboard/custom-metrics-chart.tsx`

- [ ] **Step 1: Install recharts if not present**

```bash
cd /home/sah/Synapse && pnpm add recharts --filter @synapse/web
```

Expected: recharts added to `apps/web/package.json`.

- [ ] **Step 2: Revenue line chart**

```typescript
// apps/web/src/components/admin/dashboard/revenue-chart.tsx
'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RevenuePoint } from '@/data/admin/dashboard'

type Props = { data: RevenuePoint[] }

export function RevenueChart({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenus (30 derniers jours)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => v.slice(5)} // MM-DD
              tick={{ fontSize: 11 }}
            />
            <YAxis tick={{ fontSize: 11 }} unit=" DT" />
            <Tooltip
              formatter={(v: number) => [`${v.toFixed(2)} DT`, 'Revenus']}
              labelFormatter={(l: string) => `Date: ${l}`}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Student type bar chart**

```typescript
// apps/web/src/components/admin/dashboard/student-type-chart.tsx
'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { StudentTypePoint } from '@/data/admin/dashboard'

type Props = { data: StudentTypePoint[] }

export function StudentTypeChart({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nouveaux vs Récurrents (30 jours)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => v.slice(5)}
              tick={{ fontSize: 11 }}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip labelFormatter={(l: string) => `Date: ${l}`} />
            <Legend />
            <Bar dataKey="nouveaux" name="Nouveaux" fill="#6366f1" radius={[2, 2, 0, 0]} />
            <Bar dataKey="recurrents" name="Récurrents" fill="#22c55e" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Plan popularity pie chart**

```typescript
// apps/web/src/components/admin/dashboard/plan-pie-chart.tsx
'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PlanPopularity } from '@/data/admin/dashboard'

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7']

type Props = { data: PlanPopularity[] }

export function PlanPieChart({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Formules les plus populaires</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => [v, 'Ventes']} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 5: Custom metrics chart with target lines**

```typescript
// apps/web/src/components/admin/dashboard/custom-metrics-chart.tsx
'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CustomMetricRow } from '@/data/admin/dashboard'

type Props = { metrics: CustomMetricRow[] }

export function CustomMetricsChart({ metrics }: Props) {
  if (metrics.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Métriques personnalisées</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {metrics.map((m) => {
          const pct =
            m.target_value && m.target_value > 0
              ? Math.min((m.current_value / m.target_value) * 100, 150)
              : null
          const chartData = [{ name: m.name, valeur: m.current_value }]

          return (
            <div key={m.id}>
              <p className="mb-1 text-sm font-medium">
                {m.name}{' '}
                <span className="text-muted-foreground">
                  ({m.current_value} {m.unit}
                  {m.target_value ? ` / cible: ${m.target_value}` : ''})
                </span>
              </p>
              <ResponsiveContainer width="100%" height={60}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, m.target_value ? m.target_value * 1.2 : 'auto']}
                    hide
                  />
                  <YAxis type="category" dataKey="name" hide />
                  <Tooltip formatter={(v: number) => [`${v} ${m.unit}`, m.name]} />
                  <Bar dataKey="valeur" radius={[0, 4, 4, 0]}>
                    <Cell fill={pct !== null && pct >= 100 ? '#22c55e' : '#6366f1'} />
                  </Bar>
                  {m.target_value && (
                    <ReferenceLine x={m.target_value} stroke="#ef4444" strokeDasharray="4 2" />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 6: Commit charts**

```bash
git add apps/web/src/components/admin/dashboard/
git commit -m "feat(admin): Recharts dashboard — revenue, student type, plan pie, custom metrics"
```

---

### Task 6: Low-stock alert panel

**Files:**
- Create: `apps/web/src/components/admin/dashboard/low-stock-panel.tsx`

- [ ] **Step 1: Write component**

```typescript
// apps/web/src/components/admin/dashboard/low-stock-panel.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { LiveSnapshot } from '@/data/admin/dashboard'

type Props = { products: LiveSnapshot['lowStockProducts'] }

export function LowStockPanel({ products }: Props) {
  if (products.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Stock faible</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {products.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-sm">
              <span>{p.name}</span>
              <Badge variant={p.stock_quantity === 0 ? 'destructive' : 'secondary'}>
                {p.stock_quantity === 0 ? 'Rupture' : `${p.stock_quantity} restants`}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/admin/dashboard/low-stock-panel.tsx
git commit -m "feat(admin): low-stock alert panel"
```

---

### Task 7: Assemble the admin dashboard page

**Files:**
- Replace: `apps/web/src/app/(app-pages)/admin/dashboard/page.tsx`

- [ ] **Step 1: Read existing placeholder**

Read the file to confirm it exists and see its current content before replacing.

- [ ] **Step 2: Write the assembled dashboard page**

```typescript
// apps/web/src/app/(app-pages)/admin/dashboard/page.tsx
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getLiveSnapshot,
  getDailySummary,
  getRevenueOverTime,
  getStudentTypeSeries,
  getPlanPopularity,
  getCustomMetrics,
} from '@/data/admin/dashboard'
import { LiveIndicators } from '@/components/admin/dashboard/live-indicators'
import { DailySummaryCards } from '@/components/admin/dashboard/daily-summary'
import { RevenueChart } from '@/components/admin/dashboard/revenue-chart'
import { StudentTypeChart } from '@/components/admin/dashboard/student-type-chart'
import { PlanPieChart } from '@/components/admin/dashboard/plan-pie-chart'
import { CustomMetricsChart } from '@/components/admin/dashboard/custom-metrics-chart'
import { LowStockPanel } from '@/components/admin/dashboard/low-stock-panel'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminDashboardPage() {
  const [snapshot, summary, revenueData, studentData, planData, metricsData] =
    await Promise.all([
      getLiveSnapshot(),
      getDailySummary(),
      getRevenueOverTime(30),
      getStudentTypeSeries(30),
      getPlanPopularity(),
      getCustomMetrics(),
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
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Résumé du jour
        </h2>
        <DailySummaryCards summary={summary} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <RevenueChart data={revenueData} />
        <StudentTypeChart data={studentData} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <PlanPieChart data={planData} />
        <div className="lg:col-span-2">
          <CustomMetricsChart metrics={metricsData} />
        </div>
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

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(app-pages\)/admin/dashboard/page.tsx
git commit -m "feat(admin): assemble live admin dashboard page"
```

---

### Task 8: Verify build

- [ ] **Step 1: Type-check**

```bash
cd /home/sah/Synapse && pnpm --filter @synapse/web tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Build**

```bash
cd /home/sah/Synapse && pnpm --filter @synapse/web build
```

Expected: build completes with no errors. Note any warnings about recharts peer deps and resolve if needed.

- [ ] **Step 3: Lint**

```bash
cd /home/sah/Synapse && pnpm --filter @synapse/web lint
```

Expected: no errors.

---

## Self-review checklist

- [ ] All UI text is French
- [ ] No hardcoded category IDs or seat totals (60 is a fallback only when DB returns null)
- [ ] `LiveIndicators` is a Client Component with a `'use client'` directive
- [ ] All Recharts components have `'use client'` directives
- [ ] API route `/api/admin/dashboard/snapshot` validates admin role before returning data
- [ ] `custom_metrics` table created with RLS before usage
- [ ] `export const dynamic = 'force-dynamic'` prevents stale ISR caching on dashboard page
- [ ] `recharts` is in `apps/web/package.json` dependencies
