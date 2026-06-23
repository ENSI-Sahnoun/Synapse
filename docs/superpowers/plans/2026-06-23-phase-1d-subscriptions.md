# Phase 1D: Subscription Plans & Sales

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin manages subscription plan configuration (create, edit, toggle active). Employee sells subscriptions to students, with automatic end_date computation and loyalty points entry.

**Architecture:** Admin plan management uses `adminActionClient`. Employee subscription sale uses `employeeActionClient`. On subscription creation, a loyalty ledger entry is inserted in the same server action (not a DB trigger) to keep logic visible. `end_date` is always computed as `start_date + plan.duration_days` in the action — never set by the user.

**Tech Stack:** next-safe-action, Zod, shadcn/ui, date-fns

## Global Constraints

- Depends on Plan 1A (tables), 1B (action clients), 1C (student pages exist)
- `end_date` = `start_date + plan.duration_days` — computed in server action using `date-fns addDays`
- Cash only — no payment method tracking
- Loyalty: 1 DT paid = 1 point, inserted into `loyalty_ledger` alongside subscription
- If student has an active subscription, new one stacks (starts after current `end_date`)
- Employee cannot create, modify, or delete plans — admin only
- All commands from `/home/sah/Synapse`

---

### Task 1: Subscription plan Zod schema + data layer

**Files:**
- Create: `apps/web/src/utils/zod-schemas/subscription-plan.ts`
- Create: `apps/web/src/data/admin/subscription-plans.ts`
- Create: `apps/web/src/data/employee/subscription-plans.ts`

- [ ] **Step 1: Write schema**

```typescript
// apps/web/src/utils/zod-schemas/subscription-plan.ts
import { z } from 'zod'

export const createSubscriptionPlanSchema = z.object({
  name: z.string().min(2, 'Nom requis'),
  duration_days: z.coerce.number().int().min(1, 'Durée minimum 1 jour'),
  price_dt: z.coerce.number().min(0, 'Prix invalide'),
})

export type CreateSubscriptionPlanInput = z.infer<typeof createSubscriptionPlanSchema>

export const updateSubscriptionPlanSchema = createSubscriptionPlanSchema.partial().extend({
  id: z.string().uuid(),
})

export const togglePlanSchema = z.object({
  id: z.string().uuid(),
  is_active: z.boolean(),
})
```

- [ ] **Step 2: Write test for schema**

```typescript
// apps/web/src/utils/zod-schemas/subscription-plan.test.ts
import { describe, it, expect } from 'vitest'
import { createSubscriptionPlanSchema } from './subscription-plan'

describe('createSubscriptionPlanSchema', () => {
  it('passes valid plan', () => {
    const result = createSubscriptionPlanSchema.safeParse({
      name: 'Mensuel',
      duration_days: 30,
      price_dt: 70,
    })
    expect(result.success).toBe(true)
  })

  it('coerces string numbers', () => {
    const result = createSubscriptionPlanSchema.safeParse({
      name: 'Journalier',
      duration_days: '1',
      price_dt: '6',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.duration_days).toBe(1)
      expect(result.data.price_dt).toBe(6)
    }
  })

  it('rejects zero duration', () => {
    const result = createSubscriptionPlanSchema.safeParse({ name: 'Test', duration_days: 0, price_dt: 10 })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 3: Run test**

```bash
cd apps/web && pnpm test -- --reporter=verbose subscription-plan.test
```

Expected: 3 passing.

- [ ] **Step 4: Admin data layer**

```typescript
// apps/web/src/data/admin/subscription-plans.ts
'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export async function listSubscriptionPlans() {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .order('price_dt', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getSubscriptionPlanById(id: string) {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}
```

- [ ] **Step 5: Employee data layer (active plans only)**

```typescript
// apps/web/src/data/employee/subscription-plans.ts
'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export async function listActivePlans() {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('id, name, duration_days, price_dt')
    .eq('is_active', true)
    .order('price_dt', { ascending: true })
  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/utils/zod-schemas/subscription-plan.ts \
        apps/web/src/utils/zod-schemas/subscription-plan.test.ts \
        apps/web/src/data/admin/subscription-plans.ts \
        apps/web/src/data/employee/subscription-plans.ts
git commit -m "feat(plans): add subscription plan schema and data layer"
```

---

### Task 2: Admin subscription plan actions

**Files:**
- Create: `apps/web/src/actions/admin/subscription-plans.ts`
- Create: `apps/web/src/actions/admin/subscription-plans.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/src/actions/admin/subscription-plans.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/safe-action', () => ({
  adminActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn(),
  },
}))

describe('subscription plan actions', () => {
  it('createPlanAction is defined', async () => {
    const { createPlanAction } = await import('./subscription-plans')
    expect(createPlanAction).toBeDefined()
  })

  it('togglePlanAction is defined', async () => {
    const { togglePlanAction } = await import('./subscription-plans')
    expect(togglePlanAction).toBeDefined()
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
cd apps/web && pnpm test -- --reporter=verbose subscription-plans.test 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 3: Implement actions**

```typescript
// apps/web/src/actions/admin/subscription-plans.ts
'use server'

import { adminActionClient } from '@/lib/safe-action'
import {
  createSubscriptionPlanSchema,
  updateSubscriptionPlanSchema,
  togglePlanSchema,
} from '@/utils/zod-schemas/subscription-plan'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'

export const createPlanAction = adminActionClient
  .schema(createSubscriptionPlanSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { data, error } = await supabase
      .from('subscription_plans')
      .insert(parsedInput)
      .select()
      .single()
    if (error) throw new Error(error.message)
    revalidatePath('/admin/subscription-plans')
    return { plan: data }
  })

export const updatePlanAction = adminActionClient
  .schema(updateSubscriptionPlanSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...updates } = parsedInput
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('subscription_plans')
      .update(updates)
      .eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/subscription-plans')
    return { success: true }
  })

export const togglePlanAction = adminActionClient
  .schema(togglePlanSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('subscription_plans')
      .update({ is_active: parsedInput.is_active })
      .eq('id', parsedInput.id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/subscription-plans')
    return { success: true }
  })
```

- [ ] **Step 4: Run passing test**

```bash
cd apps/web && pnpm test -- --reporter=verbose subscription-plans.test
```

Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/actions/admin/subscription-plans.ts \
        apps/web/src/actions/admin/subscription-plans.test.ts
git commit -m "feat(plans): add admin subscription plan actions"
```

---

### Task 3: Admin subscription plan pages

**Files:**
- Create: `apps/web/src/app/admin/subscription-plans/page.tsx`
- Create: `apps/web/src/app/admin/subscription-plans/new/page.tsx`

- [ ] **Step 1: Plan list page with toggle**

```typescript
// apps/web/src/app/admin/subscription-plans/page.tsx
import { listSubscriptionPlans } from '@/data/admin/subscription-plans'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TogglePlanButton } from './toggle-plan-button'

export default async function SubscriptionPlansPage() {
  const plans = await listSubscriptionPlans()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Formules d'abonnement</h1>
        <Button asChild>
          <Link href="/admin/subscription-plans/new">Nouvelle formule</Link>
        </Button>
      </div>
      <div className="border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2">Nom</th>
              <th className="text-left px-4 py-2">Durée</th>
              <th className="text-left px-4 py-2">Prix</th>
              <th className="text-left px-4 py-2">Statut</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{plan.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{plan.duration_days} jour(s)</td>
                <td className="px-4 py-2">{plan.price_dt} DT</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${plan.is_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                    {plan.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <TogglePlanButton id={plan.id} isActive={plan.is_active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create toggle button client component**

```typescript
// apps/web/src/app/admin/subscription-plans/toggle-plan-button.tsx
'use client'

import { useAction } from 'next-safe-action/hooks'
import { togglePlanAction } from '@/actions/admin/subscription-plans'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function TogglePlanButton({ id, isActive }: { id: string; isActive: boolean }) {
  const { execute, status } = useAction(togglePlanAction, {
    onSuccess: () => toast.success(isActive ? 'Formule désactivée' : 'Formule activée'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={status === 'executing'}
      onClick={() => execute({ id, is_active: !isActive })}
    >
      {isActive ? 'Désactiver' : 'Activer'}
    </Button>
  )
}
```

- [ ] **Step 3: New plan page**

```typescript
// apps/web/src/app/admin/subscription-plans/new/page.tsx
'use client'

import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createPlanAction } from '@/actions/admin/subscription-plans'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createSubscriptionPlanSchema, type CreateSubscriptionPlanInput } from '@/utils/zod-schemas/subscription-plan'
import Link from 'next/link'

export default function NewSubscriptionPlanPage() {
  const router = useRouter()
  const form = useForm<CreateSubscriptionPlanInput>({
    resolver: zodResolver(createSubscriptionPlanSchema),
    defaultValues: { name: '', duration_days: 30, price_dt: 70 },
  })

  const { execute, status } = useAction(createPlanAction, {
    onSuccess: () => { toast.success('Formule créée'); router.push('/admin/subscription-plans') },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <div className="space-y-4">
      <Link href="/admin/subscription-plans" className="text-sm text-muted-foreground hover:underline">
        ← Formules
      </Link>
      <h1 className="text-2xl font-semibold">Nouvelle formule</h1>
      <form onSubmit={form.handleSubmit((d) => execute(d))} className="space-y-4 max-w-sm">
        <div className="space-y-1">
          <Label>Nom *</Label>
          <Input {...form.register('name')} placeholder="ex: Mensuel" />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Durée (jours) *</Label>
          <Input type="number" {...form.register('duration_days')} />
          {form.formState.errors.duration_days && (
            <p className="text-sm text-destructive">{form.formState.errors.duration_days.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Prix (DT) *</Label>
          <Input type="number" step="0.5" {...form.register('price_dt')} />
        </div>
        <Button type="submit" disabled={status === 'executing'}>
          {status === 'executing' ? 'Création...' : 'Créer la formule'}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/src/app/admin/subscription-plans/
git commit -m "feat(plans): add admin subscription plan management pages"
```

---

### Task 4: Subscription sale action (employee)

**Files:**
- Create: `apps/web/src/utils/zod-schemas/subscription.ts`
- Create: `apps/web/src/actions/employee/subscriptions.ts`
- Create: `apps/web/src/actions/employee/subscriptions.test.ts`

- [ ] **Step 1: Write subscription Zod schema**

```typescript
// apps/web/src/utils/zod-schemas/subscription.ts
import { z } from 'zod'

export const createSubscriptionSchema = z.object({
  student_id: z.string().uuid('ID étudiant invalide'),
  plan_id: z.string().uuid('Formule invalide'),
  // start_date defaults to today in action; allow override for edge cases
  start_date: z.string().date().optional(),
})

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>
```

- [ ] **Step 2: Write failing test**

```typescript
// apps/web/src/actions/employee/subscriptions.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/safe-action', () => ({
  employeeActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn(),
  },
}))

vi.mock('@/supabase-clients/server', () => ({
  createSupabaseClient: vi.fn(),
}))

describe('createSubscriptionAction', () => {
  it('is defined', async () => {
    const { createSubscriptionAction } = await import('./subscriptions')
    expect(createSubscriptionAction).toBeDefined()
  })
})
```

- [ ] **Step 3: Run failing test**

```bash
cd apps/web && pnpm test -- --reporter=verbose subscriptions.test 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 4: Implement subscription sale action**

```typescript
// apps/web/src/actions/employee/subscriptions.ts
'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { createSubscriptionSchema } from '@/utils/zod-schemas/subscription'
import { createSupabaseClient } from '@/supabase-clients/server'
import { addDays, format, parseISO, max } from 'date-fns'
import { revalidatePath } from 'next/cache'

export const createSubscriptionAction = employeeActionClient
  .schema(createSubscriptionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { student_id, plan_id, start_date: startDateOverride } = parsedInput
    const supabase = await createSupabaseClient()

    // Fetch plan details
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('duration_days, price_dt, name, is_active')
      .eq('id', plan_id)
      .single()

    if (planError || !plan) throw new Error('Formule introuvable')
    if (!plan.is_active) throw new Error('Cette formule est désactivée')

    // Compute start_date: stack after current active subscription if one exists
    const today = format(new Date(), 'yyyy-MM-dd')

    const { data: activeSubscription } = await supabase
      .from('subscriptions')
      .select('end_date')
      .eq('student_id', student_id)
      .gte('end_date', today)
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    let startDate: Date
    if (startDateOverride) {
      startDate = parseISO(startDateOverride)
    } else if (activeSubscription) {
      // Stack: new subscription starts day after current expiry
      startDate = addDays(parseISO(activeSubscription.end_date), 1)
    } else {
      startDate = new Date()
    }

    const endDate = addDays(startDate, plan.duration_days)

    // Insert subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        student_id,
        plan_id,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        paid_amount: plan.price_dt,
        sold_by: ctx.userId,
      })
      .select()
      .single()

    if (subError) throw new Error(`Erreur création: ${subError.message}`)

    // Insert loyalty points: 1 DT = 1 point
    const points = Math.floor(plan.price_dt)
    if (points > 0) {
      await supabase.from('loyalty_ledger').insert({
        student_id,
        points_delta: points,
        reason: 'subscription',
        ref_id: subscription.id,
      })
    }

    revalidatePath(`/employee/students/${student_id}`)
    revalidatePath(`/admin/students/${student_id}`)

    return {
      subscriptionId: subscription.id,
      endDate: format(endDate, 'yyyy-MM-dd'),
      pointsEarned: points,
    }
  })
```

- [ ] **Step 5: Run passing test**

```bash
cd apps/web && pnpm test -- --reporter=verbose subscriptions.test
```

Expected: 1 passing.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/utils/zod-schemas/subscription.ts \
        apps/web/src/actions/employee/subscriptions.ts \
        apps/web/src/actions/employee/subscriptions.test.ts
git commit -m "feat(subscriptions): add createSubscriptionAction with auto end_date and loyalty points"
```

---

### Task 5: Subscription sale page (employee)

**Files:**
- Create: `apps/web/src/app/employee/students/[studentId]/subscriptions/new/page.tsx`

- [ ] **Step 1: Create subscription sale page**

```typescript
// apps/web/src/app/employee/students/[studentId]/subscriptions/new/page.tsx
import { getStudentById, getActiveSubscription } from '@/data/employee/students'
import { listActivePlans } from '@/data/employee/subscription-plans'
import { notFound } from 'next/navigation'
import { SellSubscriptionForm } from './sell-subscription-form'
import Link from 'next/link'
import { addDays, format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export default async function NewSubscriptionPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params
  const [student, plans, activeSubscription] = await Promise.all([
    getStudentById(studentId).catch(() => null),
    listActivePlans(),
    getActiveSubscription(studentId),
  ])

  if (!student) notFound()

  const today = format(new Date(), 'yyyy-MM-dd')
  const stackStartDate = activeSubscription
    ? format(addDays(parseISO(activeSubscription.end_date), 1), 'yyyy-MM-dd')
    : today

  return (
    <div className="space-y-4">
      <Link
        href={`/employee/students/${studentId}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← {student.full_name}
      </Link>
      <h1 className="text-2xl font-semibold">Vendre un abonnement</h1>

      {activeSubscription && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm">
          <p className="font-medium text-amber-800">Abonnement actif détecté</p>
          <p className="text-amber-700">
            Le nouvel abonnement débutera le {format(parseISO(stackStartDate), 'dd MMMM yyyy', { locale: fr })}
          </p>
        </div>
      )}

      <SellSubscriptionForm
        studentId={studentId}
        plans={plans}
        stackStartDate={stackStartDate}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create sell subscription form client component**

```typescript
// apps/web/src/app/employee/students/[studentId]/subscriptions/new/sell-subscription-form.tsx
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createSubscriptionAction } from '@/actions/employee/subscriptions'
import { Button } from '@/components/ui/button'
import { addDays, format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Plan {
  id: string
  name: string
  duration_days: number
  price_dt: number
}

interface Props {
  studentId: string
  plans: Plan[]
  stackStartDate: string
}

export function SellSubscriptionForm({ studentId, plans, stackStartDate }: Props) {
  const router = useRouter()
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')

  const selectedPlan = plans.find((p) => p.id === selectedPlanId)
  const previewEndDate = selectedPlan
    ? format(addDays(parseISO(stackStartDate), selectedPlan.duration_days), 'dd MMMM yyyy', { locale: fr })
    : null

  const { execute, status } = useAction(createSubscriptionAction, {
    onSuccess: ({ data }) => {
      toast.success(
        `Abonnement créé — ${data?.pointsEarned} point(s) Synapse attribué(s)`
      )
      router.push(`/employee/students/${studentId}`)
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <div className="space-y-4 max-w-sm">
      <div className="space-y-2">
        <p className="text-sm font-medium">Choisir une formule</p>
        <div className="grid gap-2">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlanId(plan.id)}
              className={`border rounded-md p-3 text-left text-sm transition-colors ${
                selectedPlanId === plan.id
                  ? 'border-primary bg-primary/5'
                  : 'hover:bg-muted'
              }`}
            >
              <div className="flex justify-between">
                <span className="font-medium">{plan.name}</span>
                <span className="font-semibold">{plan.price_dt} DT</span>
              </div>
              <p className="text-muted-foreground text-xs mt-0.5">{plan.duration_days} jour(s)</p>
            </button>
          ))}
        </div>
      </div>

      {selectedPlan && (
        <div className="bg-muted rounded-md p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span>Début:</span>
            <span>{format(parseISO(stackStartDate), 'dd/MM/yyyy')}</span>
          </div>
          <div className="flex justify-between">
            <span>Fin:</span>
            <span className="font-medium">{previewEndDate}</span>
          </div>
          <div className="flex justify-between">
            <span>Montant:</span>
            <span className="font-semibold">{selectedPlan.price_dt} DT (espèces)</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Points Synapse:</span>
            <span>+{Math.floor(selectedPlan.price_dt)} pts</span>
          </div>
        </div>
      )}

      <Button
        disabled={!selectedPlanId || status === 'executing'}
        onClick={() => execute({ student_id: studentId, plan_id: selectedPlanId })}
        className="w-full"
      >
        {status === 'executing' ? 'Enregistrement...' : 'Confirmer la vente'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/src/app/employee/students/
git commit -m "feat(subscriptions): add subscription sale page with plan preview"
```

---

### Task 6: Install date-fns (if not present)

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Check if date-fns is installed**

```bash
grep 'date-fns' apps/web/package.json
```

If already present, skip to Step 3.

- [ ] **Step 2: Install if missing**

```bash
cd apps/web && pnpm add date-fns
```

- [ ] **Step 3: Verify build**

```bash
pnpm build --filter=web 2>&1 | tail -20
```

Expected: build completes without errors. If `loyalty_ledger` table type is missing (not in generated types yet), add it to Plan 1A Task 6 and re-run gen-types.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore: ensure date-fns is installed"
```
