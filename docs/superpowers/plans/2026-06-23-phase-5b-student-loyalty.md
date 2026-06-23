# Phase 5B: Student Loyalty Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the student PWA loyalty page (`/student/loyalty`) showing the current point balance, the full ledger history, and a list of redeemable rewards with a "Demander" button that creates a pending redemption request.

**Architecture:** Server component fetches balance (SUM of `points_delta`), ledger rows, active rules, and existing pending requests for the student. A client component handles the "Demander" action via `studentActionClient`. Students cannot request a reward they already have pending, or when their balance is below the threshold.

**Tech Stack:** next-safe-action, Zod, shadcn/ui (Card, Badge), date-fns

## Global Constraints

- Depends on Phase 5A (migration + `loyalty_redemption_requests` table exists, `loyalty_rules` seeded)
- Balance = `SUM(points_delta)` — never a stored column — computed server-side
- Student can only request a reward if: balance ≥ rule.points_threshold AND no existing `pending` request for that rule
- `studentActionClient` from `@/lib/safe-action`
- French UI — all labels, toasts, and errors in French
- All commands from `/home/sah/Synapse`

---

### Task 1: Student loyalty data layer

**Files:**
- Create: `apps/web/src/data/student/loyalty.ts`

- [ ] **Step 1: Write data layer**

```typescript
// apps/web/src/data/student/loyalty.ts
'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

/** Returns current loyalty point balance for the authenticated student. */
export async function getStudentLoyaltyBalance(studentId: string): Promise<number> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('loyalty_ledger')
    .select('points_delta')
    .eq('student_id', studentId)
  if (error) throw error
  return (data ?? []).reduce((sum, row) => sum + row.points_delta, 0)
}

/** Returns full ledger history for the student, newest first. */
export async function getStudentLoyaltyLedger(studentId: string) {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('loyalty_ledger')
    .select('id, points_delta, reason, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Returns all active loyalty rules. */
export async function getActiveLoyaltyRules() {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('loyalty_rules')
    .select('id, name, reward_type, points_threshold, reward_value')
    .eq('is_active', true)
    .order('points_threshold', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** Returns pending redemption request IDs for the student (to prevent duplicates). */
export async function getStudentPendingRequestRuleIds(studentId: string): Promise<string[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('loyalty_redemption_requests')
    .select('rule_id')
    .eq('student_id', studentId)
    .eq('status', 'pending')
  if (error) throw error
  return (data ?? []).map((r) => r.rule_id)
}

/** Returns all redemption requests for the student, newest first. */
export async function getStudentRedemptionRequests(studentId: string) {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('loyalty_redemption_requests')
    .select('id, status, points_used, created_at, handled_at, loyalty_rules(name)')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/data/student/loyalty.ts
git commit -m "feat(loyalty): add student loyalty data layer"
```

---

### Task 2: Student redemption request Zod schema + action

**Files:**
- Create: `apps/web/src/utils/zod-schemas/loyalty-redemption.ts`
- Create: `apps/web/src/actions/student/request-redemption.ts`
- Create: `apps/web/src/actions/student/request-redemption.test.ts`

- [ ] **Step 1: Write schema**

```typescript
// apps/web/src/utils/zod-schemas/loyalty-redemption.ts
import { z } from 'zod'

export const requestRedemptionSchema = z.object({
  rule_id: z.string().uuid('Règle invalide'),
})

export type RequestRedemptionInput = z.infer<typeof requestRedemptionSchema>
```

- [ ] **Step 2: Write failing test**

```typescript
// apps/web/src/actions/student/request-redemption.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/safe-action', () => ({
  studentActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn(),
  },
}))

vi.mock('@/supabase-clients/server', () => ({
  createSupabaseClient: vi.fn(),
}))

describe('requestRedemptionAction', () => {
  it('is defined', async () => {
    const { requestRedemptionAction } = await import('./request-redemption')
    expect(requestRedemptionAction).toBeDefined()
  })
})
```

- [ ] **Step 3: Run failing test**

```bash
cd apps/web && pnpm test -- --reporter=verbose request-redemption.test 2>&1 | tail -10
```

Expected: FAIL (module not found).

- [ ] **Step 4: Implement action**

```typescript
// apps/web/src/actions/student/request-redemption.ts
'use server'

import { studentActionClient } from '@/lib/safe-action'
import { requestRedemptionSchema } from '@/utils/zod-schemas/loyalty-redemption'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'

export const requestRedemptionAction = studentActionClient
  .schema(requestRedemptionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { rule_id } = parsedInput
    const studentId = ctx.userId
    const supabase = await createSupabaseClient()

    // Fetch the rule
    const { data: rule, error: ruleError } = await supabase
      .from('loyalty_rules')
      .select('id, name, points_threshold, is_active')
      .eq('id', rule_id)
      .single()

    if (ruleError || !rule) throw new Error('Récompense introuvable')
    if (!rule.is_active) throw new Error('Cette récompense n\'est plus disponible')

    // Check for existing pending request for this rule
    const { data: existing } = await supabase
      .from('loyalty_redemption_requests')
      .select('id')
      .eq('student_id', studentId)
      .eq('rule_id', rule_id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) throw new Error('Une demande est déjà en attente pour cette récompense')

    // Compute current balance
    const { data: ledger, error: ledgerError } = await supabase
      .from('loyalty_ledger')
      .select('points_delta')
      .eq('student_id', studentId)

    if (ledgerError) throw new Error('Erreur de lecture du solde')
    const balance = (ledger ?? []).reduce((sum, row) => sum + row.points_delta, 0)

    if (balance < rule.points_threshold) {
      throw new Error(
        `Solde insuffisant: ${balance} pts disponibles, ${rule.points_threshold} pts requis`
      )
    }

    // Insert redemption request (does NOT deduct points — employee confirms physically)
    const { error: insertError } = await supabase
      .from('loyalty_redemption_requests')
      .insert({
        student_id: studentId,
        rule_id,
        status: 'pending',
        points_used: rule.points_threshold,
      })

    if (insertError) throw new Error(`Erreur lors de la demande: ${insertError.message}`)

    revalidatePath('/student/loyalty')
    return { ruleName: rule.name, pointsUsed: rule.points_threshold }
  })
```

- [ ] **Step 5: Run passing test**

```bash
cd apps/web && pnpm test -- --reporter=verbose request-redemption.test
```

Expected: 1 passing.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/utils/zod-schemas/loyalty-redemption.ts \
        apps/web/src/actions/student/request-redemption.ts \
        apps/web/src/actions/student/request-redemption.test.ts
git commit -m "feat(loyalty): add requestRedemptionAction with balance guard"
```

---

### Task 3: Student loyalty page

**Files:**
- Create: `apps/web/src/app/(student-pages)/student/loyalty/page.tsx`
- Create: `apps/web/src/app/(student-pages)/student/loyalty/request-button.tsx`

- [ ] **Step 1: Write the server component page**

```typescript
// apps/web/src/app/(student-pages)/student/loyalty/page.tsx
import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import {
  getStudentLoyaltyBalance,
  getStudentLoyaltyLedger,
  getActiveLoyaltyRules,
  getStudentPendingRequestRuleIds,
  getStudentRedemptionRequests,
} from '@/data/student/loyalty'
import { RequestButton } from './request-button'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const REWARD_TYPE_LABELS: Record<string, string> = {
  free_day: 'Journée gratuite',
  free_coffee: 'Café offert',
  discount_pct: 'Réduction %',
}

const REASON_LABELS: Record<string, string> = {
  subscription: 'Abonnement',
  purchase: 'Achat en magasin',
  redemption: 'Échange de récompense',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  fulfilled: 'Accordée',
  rejected: 'Refusée',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  fulfilled: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default async function StudentLoyaltyPage() {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const studentId = user.id

  const [balance, ledger, rules, pendingRuleIds, requests] = await Promise.all([
    getStudentLoyaltyBalance(studentId),
    getStudentLoyaltyLedger(studentId),
    getActiveLoyaltyRules(),
    getStudentPendingRequestRuleIds(studentId),
    getStudentRedemptionRequests(studentId),
  ])

  return (
    <div className="space-y-6 pb-8">
      {/* Balance card */}
      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6">
        <p className="text-sm font-medium opacity-80">Points Synapse</p>
        <p className="text-5xl font-bold mt-1">{balance}</p>
        <p className="text-xs opacity-70 mt-2">1 DT dépensé = 1 point</p>
      </div>

      {/* Redeemable rewards */}
      <section className="space-y-3">
        <h2 className="font-semibold text-base">Récompenses disponibles</h2>
        {rules.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune récompense active pour le moment.</p>
        )}
        {rules.map((rule) => {
          const canRedeem = balance >= rule.points_threshold
          const alreadyPending = pendingRuleIds.includes(rule.id)
          return (
            <div
              key={rule.id}
              className={`border rounded-lg p-4 flex items-center justify-between gap-4 ${
                canRedeem ? 'border-primary/30 bg-primary/5' : 'opacity-60'
              }`}
            >
              <div>
                <p className="font-medium text-sm">{rule.name}</p>
                <p className="text-xs text-muted-foreground">
                  {REWARD_TYPE_LABELS[rule.reward_type] ?? rule.reward_type}
                  {rule.reward_type === 'discount_pct' && ` — ${rule.reward_value}%`}
                </p>
                <p className="text-xs mt-0.5">
                  <span className={canRedeem ? 'text-primary font-semibold' : 'text-muted-foreground'}>
                    {rule.points_threshold} pts requis
                  </span>
                  {canRedeem && (
                    <span className="text-green-600 ml-2">✓ Disponible</span>
                  )}
                </p>
              </div>
              <RequestButton
                ruleId={rule.id}
                canRedeem={canRedeem}
                alreadyPending={alreadyPending}
              />
            </div>
          )
        })}
      </section>

      {/* Redemption request history */}
      {requests.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-base">Historique des demandes</h2>
          <div className="space-y-2">
            {requests.map((req) => {
              const rule = req.loyalty_rules as { name: string } | null
              return (
                <div key={req.id} className="border rounded-lg p-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{rule?.name ?? 'Récompense'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(req.created_at), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      STATUS_COLORS[req.status] ?? 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {STATUS_LABELS[req.status] ?? req.status}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Ledger history */}
      {ledger.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-base">Historique des points</h2>
          <div className="divide-y border rounded-lg">
            {ledger.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div>
                  <p>{REASON_LABELS[entry.reason] ?? entry.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(entry.created_at), 'dd MMM yyyy', { locale: fr })}
                  </p>
                </div>
                <span
                  className={`font-semibold ${
                    entry.points_delta >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {entry.points_delta >= 0 ? '+' : ''}{entry.points_delta} pts
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {ledger.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Aucun point gagné pour le moment. Achetez un abonnement ou un produit pour commencer.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write RequestButton client component**

```typescript
// apps/web/src/app/(student-pages)/student/loyalty/request-button.tsx
'use client'

import { useAction } from 'next-safe-action/hooks'
import { requestRedemptionAction } from '@/actions/student/request-redemption'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface Props {
  ruleId: string
  canRedeem: boolean
  alreadyPending: boolean
}

export function RequestButton({ ruleId, canRedeem, alreadyPending }: Props) {
  const { execute, status } = useAction(requestRedemptionAction, {
    onSuccess: ({ data }) =>
      toast.success(`Demande envoyée pour "${data?.ruleName}". Un employé validera votre récompense.`),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  if (alreadyPending) {
    return (
      <span className="text-xs text-amber-600 font-medium whitespace-nowrap">
        En attente…
      </span>
    )
  }

  return (
    <Button
      size="sm"
      disabled={!canRedeem || status === 'executing'}
      onClick={() => execute({ rule_id: ruleId })}
    >
      {status === 'executing' ? '...' : 'Demander'}
    </Button>
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
git add apps/web/src/app/\(student-pages\)/student/loyalty/
git commit -m "feat(loyalty): add student loyalty page with balance, rewards, and request flow"
```

---

### Task 4: Wire student nav link

**Files:**
- Modify: student nav/bottom-bar component (locate exact path first)

- [ ] **Step 1: Locate student nav component**

```bash
find apps/web/src/app/\(student-pages\) -name "*.tsx" | head -20
```

- [ ] **Step 2: Add loyalty nav link**

Find the nav items list (look for existing links like `/student/subscription` or `/student/qr`) and add:

```typescript
{ href: '/student/loyalty', label: 'Fidélité', icon: 'Star' }
```

Use whichever icon component is already in use in that nav (e.g. from `lucide-react`).

- [ ] **Step 3: Typecheck + commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/src/app/\(student-pages\)/
git commit -m "feat(loyalty): add loyalty link to student nav"
```

---

## Self-Review

- [ ] Balance computed as `SUM(points_delta)` — no stored column
- [ ] `requestRedemptionAction` uses `studentActionClient` — not `employeeActionClient`
- [ ] Guard: balance ≥ threshold AND no existing pending request before insert
- [ ] Action does NOT deduct points — only employee confirm (Phase 5C) does that
- [ ] `revalidatePath('/student/loyalty')` called after successful request insert
- [ ] `pending`, `fulfilled`, `rejected` statuses all rendered in history
- [ ] All labels/toasts in French
