# Phase 7B: Employee Dashboard — Daily Summary

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/employee/dashboard` placeholder with a focused employee dashboard showing today's check-in count, currently-inside count, subscriptions sold today, and quick-action links to common tasks.

**Architecture:** Pure React Server Component — employee data changes frequently but employees don't need Realtime; a simple `force-dynamic` server render with per-request Supabase queries is sufficient and avoids client-side complexity. Quick links use Next.js `<Link>` to employee routes already established in earlier phases. Data is fetched via a dedicated `data/employee/dashboard.ts` module using the Supabase server client.

**Tech Stack:** Next.js 16 RSC, Supabase server client, shadcn/ui (Card, Button, Badge)

## Global Constraints

- Route: `apps/web/src/app/(app-pages)/employee/dashboard/page.tsx` (replace placeholder)
- Employee role only — middleware guards `(app-pages)/employee/`
- French labels everywhere
- No Realtime subscriptions on this page — server render is sufficient
- No recharts on this page — KPI cards only
- All commands run from `/home/sah/Synapse`

---

### Task 1: Employee dashboard data layer

**Files:**
- Create: `apps/web/src/data/employee/dashboard.ts`

- [ ] **Step 1: Write data functions**

```typescript
// apps/web/src/data/employee/dashboard.ts
import { createSupabaseServerClient } from '@/supabase-clients/server'

export type EmployeeDashboardData = {
  todayCheckIns: number
  currentlyInside: number
  subscriptionsSoldToday: number
  subscriptionsRevenueToday: number
}

export async function getEmployeeDashboardData(): Promise<EmployeeDashboardData> {
  const supabase = await createSupabaseServerClient()

  const todayStr = new Date().toISOString().slice(0, 10)
  const start = todayStr + 'T00:00:00'
  const end = todayStr + 'T23:59:59'

  // Total check-ins today (any attendance row with checked_in_at today)
  const { count: todayCheckIns } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .gte('checked_in_at', start)
    .lte('checked_in_at', end)

  // Currently inside (open attendance rows — no checkout)
  const { count: currentlyInside } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .is('checked_out_at', null)

  // Subscriptions sold today
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('paid_amount')
    .gte('created_at', start)
    .lte('created_at', end)

  const subscriptionsSoldToday = subs?.length ?? 0
  const subscriptionsRevenueToday = subs?.reduce((s, r) => s + Number(r.paid_amount), 0) ?? 0

  return {
    todayCheckIns: todayCheckIns ?? 0,
    currentlyInside: currentlyInside ?? 0,
    subscriptionsSoldToday,
    subscriptionsRevenueToday,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/data/employee/dashboard.ts
git commit -m "feat(employee): dashboard data layer"
```

---

### Task 2: KPI cards component

**Files:**
- Create: `apps/web/src/components/employee/dashboard/kpi-cards.tsx`

- [ ] **Step 1: Write component**

```typescript
// apps/web/src/components/employee/dashboard/kpi-cards.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { EmployeeDashboardData } from '@/data/employee/dashboard'

type Props = { data: EmployeeDashboardData }

export function EmployeeKpiCards({ data }: Props) {
  const cards = [
    {
      label: 'Entrées aujourd\'hui',
      value: data.todayCheckIns.toString(),
      sub: 'Check-ins du jour',
    },
    {
      label: 'Présents actuellement',
      value: data.currentlyInside.toString(),
      sub: 'Dans les locaux',
    },
    {
      label: 'Abonnements vendus',
      value: data.subscriptionsSoldToday.toString(),
      sub: `${data.subscriptionsRevenueToday.toFixed(2)} DT encaissés`,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{c.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{c.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/employee/dashboard/kpi-cards.tsx
git commit -m "feat(employee): KPI cards component"
```

---

### Task 3: Quick-action links component

**Files:**
- Create: `apps/web/src/components/employee/dashboard/quick-links.tsx`

- [ ] **Step 1: Write component**

```typescript
// apps/web/src/components/employee/dashboard/quick-links.tsx
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const QUICK_LINKS = [
  { label: 'Scanner un QR', href: '/employee/checkin', description: 'Check-in / check-out étudiant' },
  { label: 'Vendre un abonnement', href: '/employee/subscriptions/new', description: 'Nouvelle vente d\'abonnement' },
  { label: 'Caisse (POS)', href: '/employee/pos', description: 'Vente en magasin' },
  { label: 'Présences', href: '/employee/attendance', description: 'Gérer les présences du jour' },
  { label: 'Étudiants', href: '/employee/students', description: 'Rechercher ou créer un étudiant' },
  { label: 'Plan des places', href: '/employee/seats', description: 'Vue en direct des places' },
] as const

export function QuickLinks() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Accès rapides</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <Button
              key={link.href}
              variant="outline"
              className="h-auto flex-col items-start gap-1 p-4 text-left"
              asChild
            >
              <Link href={link.href}>
                <span className="font-semibold">{link.label}</span>
                <span className="text-xs text-muted-foreground">{link.description}</span>
              </Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/employee/dashboard/quick-links.tsx
git commit -m "feat(employee): quick-links component"
```

---

### Task 4: Assemble employee dashboard page

**Files:**
- Replace: `apps/web/src/app/(app-pages)/employee/dashboard/page.tsx`

- [ ] **Step 1: Read existing placeholder**

Read the file before replacing to confirm its current content.

- [ ] **Step 2: Write the assembled page**

```typescript
// apps/web/src/app/(app-pages)/employee/dashboard/page.tsx
import { getEmployeeDashboardData } from '@/data/employee/dashboard'
import { EmployeeKpiCards } from '@/components/employee/dashboard/kpi-cards'
import { QuickLinks } from '@/components/employee/dashboard/quick-links'
import { createSupabaseServerClient } from '@/supabase-clients/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function EmployeeDashboardPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user!.id)
    .single()

  const data = await getEmployeeDashboardData()

  const now = new Date()
  const hour = now.getHours()
  const greeting =
    hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">
          {greeting}, {profile?.full_name ?? 'Employé'} 👋
        </h1>
        <p className="text-muted-foreground">
          {now.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Aujourd'hui
        </h2>
        <EmployeeKpiCards data={data} />
      </section>

      <section>
        <QuickLinks />
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(app-pages\)/employee/dashboard/page.tsx
git commit -m "feat(employee): assemble employee dashboard page"
```

---

### Task 5: Verify build

- [ ] **Step 1: Type-check**

```bash
cd /home/sah/Synapse && pnpm --filter @synapse/web tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Build**

```bash
cd /home/sah/Synapse && pnpm --filter @synapse/web build
```

Expected: build completes successfully.

- [ ] **Step 3: Lint**

```bash
cd /home/sah/Synapse && pnpm --filter @synapse/web lint
```

Expected: no errors.

---

## Self-review checklist

- [ ] All UI text is French
- [ ] Page uses `force-dynamic` — no stale ISR data
- [ ] `getEmployeeDashboardData` uses server client only — no browser client
- [ ] Quick links point to routes that exist (or will exist by end of their respective phases)
- [ ] No Recharts imported in this plan — kept deliberately minimal
- [ ] Greeting is computed server-side from current hour — no hydration mismatch risk (RSC)
