# Phase 5C: Employee Loyalty Requests Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the employee page (`/employee/loyalty-requests`) listing all pending redemption requests, with confirm (fulfil) and reject actions — confirm logs a negative `loyalty_ledger` entry and marks the request fulfilled.

**Architecture:** Server component fetches pending requests with student and rule details. Two `employeeActionClient` actions handle fulfil and reject. Fulfil atomically: inserts a negative `loyalty_ledger` row (points_delta = -points_used) and updates request status to `fulfilled`. Reject only updates status and records `handled_by` + `handled_at`.

**Tech Stack:** next-safe-action, Zod, shadcn/ui (Badge, Button), date-fns

## Global Constraints

- Depends on Phase 5A (table exists) and Phase 5B (students can create requests)
- `employeeActionClient` from `@/lib/safe-action`
- Fulfil action is NOT a DB transaction — insert ledger entry first, then update request. If ledger insert fails, surface error and abort (request stays pending, no partial state).
- Points deducted = `loyalty_redemption_requests.points_used` (the threshold at time of request)
- `handled_by` = `ctx.userId` (the employee performing the action)
- French UI — all labels, toasts, and errors in French
- All commands from `/home/sah/Synapse`

---

### Task 1: Employee loyalty requests data layer

**Files:**
- Create: `apps/web/src/data/employee/loyalty-requests.ts`

- [ ] **Step 1: Write data layer**

```typescript
// apps/web/src/data/employee/loyalty-requests.ts
'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export async function listPendingRedemptionRequests() {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('loyalty_redemption_requests')
    .select(`
      id,
      status,
      points_used,
      created_at,
      student:profiles!student_id(id, full_name, phone),
      rule:loyalty_rules!rule_id(id, name, reward_type, reward_value)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function listRecentFulfilledRequests(limit = 20) {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('loyalty_redemption_requests')
    .select(`
      id,
      status,
      points_used,
      created_at,
      handled_at,
      student:profiles!student_id(id, full_name),
      rule:loyalty_rules!rule_id(id, name, reward_type)
    `)
    .in('status', ['fulfilled', 'rejected'])
    .order('handled_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/data/employee/loyalty-requests.ts
git commit -m "feat(loyalty): add employee loyalty requests data layer"
```

---

### Task 2: Fulfil and reject actions

**Files:**
- Create: `apps/web/src/utils/zod-schemas/loyalty-handle-request.ts`
- Create: `apps/web/src/actions/employee/loyalty-requests.ts`
- Create: `apps/web/src/actions/employee/loyalty-requests.test.ts`

- [ ] **Step 1: Write schemas**

```typescript
// apps/web/src/utils/zod-schemas/loyalty-handle-request.ts
import { z } from 'zod'

export const handleRedemptionRequestSchema = z.object({
  request_id: z.string().uuid('ID de demande invalide'),
})

export type HandleRedemptionRequestInput = z.infer<typeof handleRedemptionRequestSchema>
```

- [ ] **Step 2: Write failing test**

```typescript
// apps/web/src/actions/employee/loyalty-requests.test.ts
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

describe('loyalty request actions', () => {
  it('fulfilRedemptionAction is defined', async () => {
    const { fulfilRedemptionAction } = await import('./loyalty-requests')
    expect(fulfilRedemptionAction).toBeDefined()
  })

  it('rejectRedemptionAction is defined', async () => {
    const { rejectRedemptionAction } = await import('./loyalty-requests')
    expect(rejectRedemptionAction).toBeDefined()
  })
})
```

- [ ] **Step 3: Run failing test**

```bash
cd apps/web && pnpm test -- --reporter=verbose loyalty-requests.test 2>&1 | tail -10
```

Expected: FAIL (module not found).

- [ ] **Step 4: Implement actions**

```typescript
// apps/web/src/actions/employee/loyalty-requests.ts
'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { handleRedemptionRequestSchema } from '@/utils/zod-schemas/loyalty-handle-request'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'

export const fulfilRedemptionAction = employeeActionClient
  .schema(handleRedemptionRequestSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { request_id } = parsedInput
    const supabase = await createSupabaseClient()

    // Fetch the request to get student_id and points_used
    const { data: request, error: fetchError } = await supabase
      .from('loyalty_redemption_requests')
      .select('id, student_id, points_used, status, rule_id')
      .eq('id', request_id)
      .single()

    if (fetchError || !request) throw new Error('Demande introuvable')
    if (request.status !== 'pending') throw new Error('Cette demande a déjà été traitée')

    // Insert negative ledger entry — deduct points
    const { error: ledgerError } = await supabase
      .from('loyalty_ledger')
      .insert({
        student_id: request.student_id,
        points_delta: -request.points_used,
        reason: 'redemption',
        ref_id: request_id,
      })

    if (ledgerError) {
      throw new Error(`Erreur lors de la déduction des points: ${ledgerError.message}`)
    }

    // Update request status to fulfilled
    const { error: updateError } = await supabase
      .from('loyalty_redemption_requests')
      .update({
        status: 'fulfilled',
        handled_by: ctx.userId,
        handled_at: new Date().toISOString(),
      })
      .eq('id', request_id)

    if (updateError) {
      throw new Error(`Erreur lors de la mise à jour: ${updateError.message}`)
    }

    revalidatePath('/employee/loyalty-requests')
    return { success: true, pointsDeducted: request.points_used }
  })

export const rejectRedemptionAction = employeeActionClient
  .schema(handleRedemptionRequestSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { request_id } = parsedInput
    const supabase = await createSupabaseClient()

    // Verify it exists and is pending
    const { data: request, error: fetchError } = await supabase
      .from('loyalty_redemption_requests')
      .select('id, status')
      .eq('id', request_id)
      .single()

    if (fetchError || !request) throw new Error('Demande introuvable')
    if (request.status !== 'pending') throw new Error('Cette demande a déjà été traitée')

    const { error: updateError } = await supabase
      .from('loyalty_redemption_requests')
      .update({
        status: 'rejected',
        handled_by: ctx.userId,
        handled_at: new Date().toISOString(),
      })
      .eq('id', request_id)

    if (updateError) throw new Error(`Erreur: ${updateError.message}`)

    revalidatePath('/employee/loyalty-requests')
    return { success: true }
  })
```

- [ ] **Step 5: Run passing tests**

```bash
cd apps/web && pnpm test -- --reporter=verbose loyalty-requests.test
```

Expected: 2 passing.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/utils/zod-schemas/loyalty-handle-request.ts \
        apps/web/src/actions/employee/loyalty-requests.ts \
        apps/web/src/actions/employee/loyalty-requests.test.ts
git commit -m "feat(loyalty): add employee fulfil/reject redemption actions"
```

---

### Task 3: Employee loyalty requests page

**Files:**
- Create: `apps/web/src/app/(employee-pages)/employee/loyalty-requests/page.tsx`
- Create: `apps/web/src/app/(employee-pages)/employee/loyalty-requests/request-actions.tsx`

- [ ] **Step 1: Write server component page**

```typescript
// apps/web/src/app/(employee-pages)/employee/loyalty-requests/page.tsx
import {
  listPendingRedemptionRequests,
  listRecentFulfilledRequests,
} from '@/data/employee/loyalty-requests'
import { RequestActions } from './request-actions'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const REWARD_TYPE_LABELS: Record<string, string> = {
  free_day: 'Journée gratuite',
  free_coffee: 'Café offert',
  discount_pct: 'Réduction %',
}

export default async function EmployeeLoyaltyRequestsPage() {
  const [pending, recent] = await Promise.all([
    listPendingRedemptionRequests(),
    listRecentFulfilledRequests(20),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Demandes de récompenses</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Validez physiquement la récompense, puis confirmez dans le système.
        </p>
      </div>

      {/* Pending requests */}
      <section className="space-y-3">
        <h2 className="font-medium text-base flex items-center gap-2">
          En attente
          {pending.length > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
              {pending.length}
            </span>
          )}
        </h2>

        {pending.length === 0 && (
          <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
            Aucune demande en attente.
          </div>
        )}

        {pending.map((req) => {
          const student = req.student as { id: string; full_name: string; phone: string | null } | null
          const rule = req.rule as { id: string; name: string; reward_type: string; reward_value: number } | null
          return (
            <div
              key={req.id}
              className="border rounded-lg p-4 flex items-start justify-between gap-4"
            >
              <div className="space-y-1">
                <p className="font-medium text-sm">{student?.full_name ?? 'Étudiant inconnu'}</p>
                {student?.phone && (
                  <p className="text-xs text-muted-foreground">{student.phone}</p>
                )}
                <p className="text-sm">
                  <span className="font-medium">{rule?.name ?? 'Récompense'}</span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {REWARD_TYPE_LABELS[rule?.reward_type ?? ''] ?? rule?.reward_type}
                    {rule?.reward_type === 'discount_pct' && ` — ${rule.reward_value}%`}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {req.points_used} pts · Demandé le{' '}
                  {format(new Date(req.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                </p>
              </div>
              <RequestActions requestId={req.id} />
            </div>
          )
        })}
      </section>

      {/* Recent handled */}
      {recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium text-base">Traitées récemment</h2>
          <div className="border rounded-lg divide-y">
            {recent.map((req) => {
              const student = req.student as { id: string; full_name: string } | null
              const rule = req.rule as { id: string; name: string; reward_type: string } | null
              return (
                <div
                  key={req.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{student?.full_name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {rule?.name} · {req.points_used} pts
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        req.status === 'fulfilled'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {req.status === 'fulfilled' ? 'Accordée' : 'Refusée'}
                    </span>
                    {req.handled_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(req.handled_at), 'dd MMM HH:mm', { locale: fr })}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write RequestActions client component**

```typescript
// apps/web/src/app/(employee-pages)/employee/loyalty-requests/request-actions.tsx
'use client'

import { useAction } from 'next-safe-action/hooks'
import { fulfilRedemptionAction, rejectRedemptionAction } from '@/actions/employee/loyalty-requests'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function RequestActions({ requestId }: { requestId: string }) {
  const { execute: fulfil, status: fulfilStatus } = useAction(fulfilRedemptionAction, {
    onSuccess: ({ data }) =>
      toast.success(`Récompense accordée — ${data?.pointsDeducted} pts déduits`),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const { execute: reject, status: rejectStatus } = useAction(rejectRedemptionAction, {
    onSuccess: () => toast.success('Demande refusée'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const busy = fulfilStatus === 'executing' || rejectStatus === 'executing'

  return (
    <div className="flex gap-2 shrink-0">
      <Button
        size="sm"
        disabled={busy}
        onClick={() => fulfil({ request_id: requestId })}
      >
        {fulfilStatus === 'executing' ? '...' : 'Confirmer'}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => reject({ request_id: requestId })}
      >
        {rejectStatus === 'executing' ? '...' : 'Refuser'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(employee-pages\)/employee/loyalty-requests/
git commit -m "feat(loyalty): add employee loyalty requests page with confirm/reject"
```

---

### Task 4: Wire employee nav link

**Files:**
- Modify: employee nav component (locate exact path first)

- [ ] **Step 1: Locate employee nav component**

```bash
find apps/web/src/app/\(employee-pages\) -name "*.tsx" | head -20
```

- [ ] **Step 2: Add loyalty-requests link to employee nav**

Find the nav items list (look for existing links like `/employee/checkin` or `/employee/students`) and add:

```typescript
{ href: '/employee/loyalty-requests', label: 'Récompenses' }
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/src/app/\(employee-pages\)/
git commit -m "feat(loyalty): add loyalty-requests link to employee nav"
```

---

## Self-Review

- [ ] `fulfilRedemptionAction` inserts negative ledger entry (`points_delta = -points_used`) before updating status
- [ ] If ledger insert fails, action throws — request remains `pending` (no partial state)
- [ ] `rejectRedemptionAction` does NOT touch `loyalty_ledger` — only updates request status
- [ ] Both actions guard against double-processing (`status !== 'pending'` check)
- [ ] `handled_by` = `ctx.userId` (employee's profile id) stored on the request
- [ ] `revalidatePath('/employee/loyalty-requests')` called in both actions
- [ ] Page shows count badge on pending section
- [ ] All labels/toasts in French
