# Phase 5A: Loyalty Rules Migration + Admin Management Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `loyalty_redemption_requests` migration, seed default loyalty rules, and build the admin `/admin/loyalty` page for creating, editing, and toggling loyalty rules.

**Architecture:** A single migration handles the new `loyalty_redemption_requests` table (with FK to `loyalty_rules` and `profiles`) and seeds the three default rules. Admin actions use `adminActionClient`. The admin page is a server component list with a client-side toggle button and a shadcn dialog for create/edit.

**Tech Stack:** next-safe-action, Zod, shadcn/ui (Dialog, Table, Switch), date-fns

## Global Constraints

- Migration timestamp prefix must be ≥ `20260623300000` (Phase 5 range)
- RLS must be enabled on all new tables
- `loyalty_rules` table already exists from Phase 1A — do not recreate it, only seed defaults
- `loyalty_redemption_requests` is new in Phase 5A
- All commands run from `/home/sah/Synapse`
- French UI — all labels, toasts, and errors in French
- `adminActionClient` from `@/lib/safe-action`
- Action clients context provides `ctx.userId`

---

### Task 1: Migration — loyalty_redemption_requests + default rule seeds

**Files:**
- Create: `apps/database/supabase/migrations/20260623300000_smp_loyalty_redemption_requests.sql`

- [ ] **Step 1: Write migration**

```sql
-- apps/database/supabase/migrations/20260623300000_smp_loyalty_redemption_requests.sql

-- Seed default loyalty rules (skip if already seeded)
INSERT INTO public.loyalty_rules (name, reward_type, points_threshold, reward_value, is_active)
SELECT name, reward_type, points_threshold, reward_value, true
FROM (VALUES
  ('Journée gratuite',  'free_day',      70, 0),
  ('Café offert',       'free_coffee',   30, 0),
  ('Réduction 10%',     'discount_pct',  50, 10)
) AS defaults(name, reward_type, points_threshold, reward_value)
WHERE NOT EXISTS (SELECT 1 FROM public.loyalty_rules LIMIT 1);

-- Redemption requests table
CREATE TABLE public.loyalty_redemption_requests (
  id          uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  student_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rule_id     uuid        NOT NULL REFERENCES public.loyalty_rules(id) ON DELETE RESTRICT,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'fulfilled', 'rejected')),
  points_used int         NOT NULL CHECK (points_used > 0),
  handled_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  handled_at  timestamptz
);

-- Index: employee view queries pending requests sorted by created_at
CREATE INDEX loyalty_redemption_requests_status_idx
  ON public.loyalty_redemption_requests (status, created_at DESC);

-- Index: student queries own requests
CREATE INDEX loyalty_redemption_requests_student_idx
  ON public.loyalty_redemption_requests (student_id, created_at DESC);

ALTER TABLE public.loyalty_redemption_requests ENABLE ROW LEVEL SECURITY;

-- Students: read own requests, insert own requests
CREATE POLICY "redemption_requests_select_own" ON public.loyalty_redemption_requests
  FOR SELECT USING (
    student_id = auth.uid()
    OR public.current_user_role() IN ('admin', 'employee')
  );

CREATE POLICY "redemption_requests_insert" ON public.loyalty_redemption_requests
  FOR INSERT WITH CHECK (
    student_id = auth.uid()
    AND public.current_user_role() = 'student'
  );

-- Employees and admins: update status + handled_by + handled_at
CREATE POLICY "redemption_requests_update" ON public.loyalty_redemption_requests
  FOR UPDATE USING (public.current_user_role() IN ('admin', 'employee'));

-- Admin only: delete
CREATE POLICY "redemption_requests_delete" ON public.loyalty_redemption_requests
  FOR DELETE USING (public.current_user_role() = 'admin');
```

- [ ] **Step 2: Apply migration locally**

```bash
cd apps/database && pnpm supabase db reset
```

Expected output ends with: `Finished supabase db reset`

- [ ] **Step 3: Regenerate TypeScript types**

```bash
cd /home/sah/Synapse && pnpm gen-types-local
```

Verify `apps/web/src/lib/database.types.ts` contains `loyalty_redemption_requests` and the `loyalty_rules` seed rows are visible via Studio.

- [ ] **Step 4: Commit**

```bash
git add apps/database/supabase/migrations/20260623300000_smp_loyalty_redemption_requests.sql \
        apps/web/src/lib/database.types.ts
git commit -m "feat(db): add loyalty_redemption_requests table and seed default loyalty rules"
```

---

### Task 2: Loyalty rule Zod schemas

**Files:**
- Create: `apps/web/src/utils/zod-schemas/loyalty-rule.ts`
- Create: `apps/web/src/utils/zod-schemas/loyalty-rule.test.ts`

- [ ] **Step 1: Write schema**

```typescript
// apps/web/src/utils/zod-schemas/loyalty-rule.ts
import { z } from 'zod'

export const REWARD_TYPES = ['free_day', 'free_coffee', 'discount_pct'] as const
export type RewardType = typeof REWARD_TYPES[number]

export const createLoyaltyRuleSchema = z.object({
  name: z.string().min(2, 'Nom requis'),
  reward_type: z.enum(REWARD_TYPES, { errorMap: () => ({ message: 'Type de récompense invalide' }) }),
  points_threshold: z.coerce.number().int().min(1, 'Seuil minimum 1 point'),
  reward_value: z.coerce.number().min(0, 'Valeur invalide').default(0),
})

export type CreateLoyaltyRuleInput = z.infer<typeof createLoyaltyRuleSchema>

export const updateLoyaltyRuleSchema = createLoyaltyRuleSchema.partial().extend({
  id: z.string().uuid(),
})

export const toggleLoyaltyRuleSchema = z.object({
  id: z.string().uuid(),
  is_active: z.boolean(),
})
```

- [ ] **Step 2: Write tests**

```typescript
// apps/web/src/utils/zod-schemas/loyalty-rule.test.ts
import { describe, it, expect } from 'vitest'
import { createLoyaltyRuleSchema } from './loyalty-rule'

describe('createLoyaltyRuleSchema', () => {
  it('passes valid free_day rule', () => {
    const result = createLoyaltyRuleSchema.safeParse({
      name: 'Journée gratuite',
      reward_type: 'free_day',
      points_threshold: 70,
      reward_value: 0,
    })
    expect(result.success).toBe(true)
  })

  it('passes valid discount_pct rule', () => {
    const result = createLoyaltyRuleSchema.safeParse({
      name: 'Réduction 10%',
      reward_type: 'discount_pct',
      points_threshold: 50,
      reward_value: 10,
    })
    expect(result.success).toBe(true)
  })

  it('coerces string numbers', () => {
    const result = createLoyaltyRuleSchema.safeParse({
      name: 'Café offert',
      reward_type: 'free_coffee',
      points_threshold: '30',
      reward_value: '0',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.points_threshold).toBe(30)
    }
  })

  it('rejects invalid reward_type', () => {
    const result = createLoyaltyRuleSchema.safeParse({
      name: 'Test',
      reward_type: 'mystery_box',
      points_threshold: 10,
      reward_value: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects zero threshold', () => {
    const result = createLoyaltyRuleSchema.safeParse({
      name: 'Test',
      reward_type: 'free_day',
      points_threshold: 0,
      reward_value: 0,
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd apps/web && pnpm test -- --reporter=verbose loyalty-rule.test
```

Expected: 5 passing.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/utils/zod-schemas/loyalty-rule.ts \
        apps/web/src/utils/zod-schemas/loyalty-rule.test.ts
git commit -m "feat(loyalty): add loyalty rule Zod schemas"
```

---

### Task 3: Admin loyalty rule actions

**Files:**
- Create: `apps/web/src/actions/admin/loyalty-rules.ts`
- Create: `apps/web/src/actions/admin/loyalty-rules.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/src/actions/admin/loyalty-rules.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/safe-action', () => ({
  adminActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn(),
  },
}))

vi.mock('@/supabase-clients/server', () => ({
  createSupabaseClient: vi.fn(),
}))

describe('loyalty rule actions', () => {
  it('createLoyaltyRuleAction is defined', async () => {
    const { createLoyaltyRuleAction } = await import('./loyalty-rules')
    expect(createLoyaltyRuleAction).toBeDefined()
  })

  it('updateLoyaltyRuleAction is defined', async () => {
    const { updateLoyaltyRuleAction } = await import('./loyalty-rules')
    expect(updateLoyaltyRuleAction).toBeDefined()
  })

  it('toggleLoyaltyRuleAction is defined', async () => {
    const { toggleLoyaltyRuleAction } = await import('./loyalty-rules')
    expect(toggleLoyaltyRuleAction).toBeDefined()
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
cd apps/web && pnpm test -- --reporter=verbose loyalty-rules.test 2>&1 | tail -10
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement actions**

```typescript
// apps/web/src/actions/admin/loyalty-rules.ts
'use server'

import { adminActionClient } from '@/lib/safe-action'
import {
  createLoyaltyRuleSchema,
  updateLoyaltyRuleSchema,
  toggleLoyaltyRuleSchema,
} from '@/utils/zod-schemas/loyalty-rule'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'

export const createLoyaltyRuleAction = adminActionClient
  .schema(createLoyaltyRuleSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { data, error } = await supabase
      .from('loyalty_rules')
      .insert({ ...parsedInput, is_active: true })
      .select()
      .single()
    if (error) throw new Error(error.message)
    revalidatePath('/admin/loyalty')
    return { rule: data }
  })

export const updateLoyaltyRuleAction = adminActionClient
  .schema(updateLoyaltyRuleSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...updates } = parsedInput
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('loyalty_rules')
      .update(updates)
      .eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/loyalty')
    return { success: true }
  })

export const toggleLoyaltyRuleAction = adminActionClient
  .schema(toggleLoyaltyRuleSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('loyalty_rules')
      .update({ is_active: parsedInput.is_active })
      .eq('id', parsedInput.id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/loyalty')
    return { success: true }
  })
```

- [ ] **Step 4: Run passing tests**

```bash
cd apps/web && pnpm test -- --reporter=verbose loyalty-rules.test
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/actions/admin/loyalty-rules.ts \
        apps/web/src/actions/admin/loyalty-rules.test.ts
git commit -m "feat(loyalty): add admin loyalty rule CRUD actions"
```

---

### Task 4: Admin loyalty data layer

**Files:**
- Create: `apps/web/src/data/admin/loyalty-rules.ts`

- [ ] **Step 1: Write data layer**

```typescript
// apps/web/src/data/admin/loyalty-rules.ts
'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export async function listLoyaltyRules() {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('loyalty_rules')
    .select('*')
    .order('points_threshold', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getLoyaltyRuleById(id: string) {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('loyalty_rules')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/data/admin/loyalty-rules.ts
git commit -m "feat(loyalty): add admin loyalty rules data layer"
```

---

### Task 5: Admin loyalty management page

**Files:**
- Create: `apps/web/src/app/(admin-pages)/admin/loyalty/page.tsx`
- Create: `apps/web/src/app/(admin-pages)/admin/loyalty/loyalty-rule-dialog.tsx`
- Create: `apps/web/src/app/(admin-pages)/admin/loyalty/toggle-rule-button.tsx`

- [ ] **Step 1: Write loyalty rules list page (server component)**

```typescript
// apps/web/src/app/(admin-pages)/admin/loyalty/page.tsx
import { listLoyaltyRules } from '@/data/admin/loyalty-rules'
import { LoyaltyRuleDialog } from './loyalty-rule-dialog'
import { ToggleRuleButton } from './toggle-rule-button'

const REWARD_TYPE_LABELS: Record<string, string> = {
  free_day: 'Journée gratuite',
  free_coffee: 'Café offert',
  discount_pct: 'Réduction %',
}

export default async function AdminLoyaltyPage() {
  const rules = await listLoyaltyRules()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Règles de fidélité</h1>
          <p className="text-sm text-muted-foreground mt-1">
            1 DT dépensé = 1 point Synapse. Les récompenses sont débloquées selon le seuil de points.
          </p>
        </div>
        <LoyaltyRuleDialog mode="create" />
      </div>

      <div className="border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2">Nom</th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Seuil (pts)</th>
              <th className="text-left px-4 py-2">Valeur</th>
              <th className="text-left px-4 py-2">Statut</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Aucune règle définie.
                </td>
              </tr>
            )}
            {rules.map((rule) => (
              <tr key={rule.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{rule.name}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {REWARD_TYPE_LABELS[rule.reward_type] ?? rule.reward_type}
                </td>
                <td className="px-4 py-2">{rule.points_threshold} pts</td>
                <td className="px-4 py-2">
                  {rule.reward_type === 'discount_pct' ? `${rule.reward_value}%` : '—'}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      rule.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {rule.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-2 flex items-center gap-2">
                  <LoyaltyRuleDialog mode="edit" rule={rule} />
                  <ToggleRuleButton id={rule.id} isActive={rule.is_active} />
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

- [ ] **Step 2: Write LoyaltyRuleDialog client component**

```typescript
// apps/web/src/app/(admin-pages)/admin/loyalty/loyalty-rule-dialog.tsx
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createLoyaltyRuleAction, updateLoyaltyRuleAction } from '@/actions/admin/loyalty-rules'
import {
  createLoyaltyRuleSchema,
  type CreateLoyaltyRuleInput,
  REWARD_TYPES,
} from '@/utils/zod-schemas/loyalty-rule'

const REWARD_TYPE_LABELS: Record<string, string> = {
  free_day: 'Journée gratuite',
  free_coffee: 'Café offert',
  discount_pct: 'Réduction %',
}

interface LoyaltyRule {
  id: string
  name: string
  reward_type: string
  points_threshold: number
  reward_value: number
  is_active: boolean
}

type Props =
  | { mode: 'create'; rule?: undefined }
  | { mode: 'edit'; rule: LoyaltyRule }

export function LoyaltyRuleDialog({ mode, rule }: Props) {
  const [open, setOpen] = useState(false)

  const form = useForm<CreateLoyaltyRuleInput>({
    resolver: zodResolver(createLoyaltyRuleSchema),
    defaultValues:
      mode === 'edit'
        ? {
            name: rule.name,
            reward_type: rule.reward_type as CreateLoyaltyRuleInput['reward_type'],
            points_threshold: rule.points_threshold,
            reward_value: rule.reward_value,
          }
        : { name: '', reward_type: 'free_day', points_threshold: 30, reward_value: 0 },
  })

  const watchedType = form.watch('reward_type')

  const { execute: createRule, status: createStatus } = useAction(createLoyaltyRuleAction, {
    onSuccess: () => {
      toast.success('Règle créée')
      form.reset()
      setOpen(false)
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const { execute: updateRule, status: updateStatus } = useAction(updateLoyaltyRuleAction, {
    onSuccess: () => {
      toast.success('Règle mise à jour')
      setOpen(false)
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const isExecuting = createStatus === 'executing' || updateStatus === 'executing'

  function onSubmit(values: CreateLoyaltyRuleInput) {
    if (mode === 'edit') {
      updateRule({ id: rule.id, ...values })
    } else {
      createRule(values)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={mode === 'edit' ? 'ghost' : 'default'} size={mode === 'edit' ? 'sm' : 'default'}>
          {mode === 'edit' ? 'Modifier' : 'Nouvelle règle'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Modifier la règle' : 'Nouvelle règle de fidélité'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Nom *</Label>
            <Input {...form.register('name')} placeholder="ex: Journée gratuite" />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Type de récompense *</Label>
            <Select
              value={form.watch('reward_type')}
              onValueChange={(v) =>
                form.setValue('reward_type', v as CreateLoyaltyRuleInput['reward_type'])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REWARD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {REWARD_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Seuil de points *</Label>
            <Input type="number" {...form.register('points_threshold')} />
            {form.formState.errors.points_threshold && (
              <p className="text-sm text-destructive">
                {form.formState.errors.points_threshold.message}
              </p>
            )}
          </div>
          {watchedType === 'discount_pct' && (
            <div className="space-y-1">
              <Label>Valeur de la réduction (%) *</Label>
              <Input type="number" step="1" {...form.register('reward_value')} />
            </div>
          )}
          <Button type="submit" disabled={isExecuting} className="w-full">
            {isExecuting
              ? 'Enregistrement...'
              : mode === 'edit'
              ? 'Mettre à jour'
              : 'Créer la règle'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Write ToggleRuleButton client component**

```typescript
// apps/web/src/app/(admin-pages)/admin/loyalty/toggle-rule-button.tsx
'use client'

import { useAction } from 'next-safe-action/hooks'
import { toggleLoyaltyRuleAction } from '@/actions/admin/loyalty-rules'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function ToggleRuleButton({ id, isActive }: { id: string; isActive: boolean }) {
  const { execute, status } = useAction(toggleLoyaltyRuleAction, {
    onSuccess: () =>
      toast.success(isActive ? 'Règle désactivée' : 'Règle activée'),
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

- [ ] **Step 4: Typecheck**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(admin-pages\)/admin/loyalty/
git commit -m "feat(loyalty): add admin loyalty management page with create/edit/toggle"
```

---

### Task 6: Wire admin nav link

**Files:**
- Modify: `apps/web/src/app/(admin-pages)/admin/layout.tsx` (or the admin sidebar/nav component — check existing path)

- [ ] **Step 1: Locate admin nav component**

```bash
find apps/web/src/app/\(admin-pages\) -name "*.tsx" | head -20
```

- [ ] **Step 2: Add loyalty link to admin nav**

Find the nav list (look for existing links like `/admin/subscription-plans`) and add:

```typescript
{ href: '/admin/loyalty', label: 'Fidélité' }
```

Add it after the subscription-plans entry in the nav items array/list.

- [ ] **Step 3: Typecheck + commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/src/app/\(admin-pages\)/
git commit -m "feat(loyalty): add loyalty link to admin nav"
```

---

## Self-Review

- [ ] Migration timestamp is in the 5A range (`20260623300000`)
- [ ] `loyalty_rules` table is not recreated — only seeded via INSERT … WHERE NOT EXISTS
- [ ] `loyalty_redemption_requests` has FK to `loyalty_rules` (ON DELETE RESTRICT) and `profiles`
- [ ] RLS on `loyalty_redemption_requests`: students insert only their own, employees/admins update
- [ ] `createLoyaltyRuleSchema` uses `z.coerce` for numeric fields
- [ ] Dialog conditionally shows `reward_value` field only for `discount_pct` type
- [ ] All labels/toasts in French
- [ ] `revalidatePath('/admin/loyalty')` called in all three actions
