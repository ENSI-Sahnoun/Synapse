# Phase 4D: Admin Settings Page — Exam Mode Toggle + Reservation Hold Duration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/admin/settings` with a UI for toggling exam mode on/off and adjusting the reservation hold duration, backed by `adminActionClient` server actions that UPSERT into the `settings` table.

**Architecture:** A single RSC page fetches all relevant `settings` rows and renders two controlled form sections. Each section has its own server action that UPSERTs the relevant `settings` key. No full-page reload — `useAction` from `next-safe-action` updates UI optimistically and shows a success toast on confirmation. The settings table already exists (created in Phase 1A) with pre-seeded rows for `exam_mode`, `reservation_hold_minutes`, and `priority_min_duration_days`.

**Tech Stack:** Next.js 16 server actions, `adminActionClient`, Supabase server client, Zod, `next-safe-action/hooks` (`useAction`), `sonner` (toasts), Shadcn UI (`Switch`, `Input`, `Button`, `Card`)

## Global Constraints

- `adminActionClient` for all mutations — no employee access to settings
- Settings keys are exact strings: `'exam_mode'`, `'reservation_hold_minutes'`, `'priority_min_duration_days'`
- UPSERT pattern: `INSERT ... ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
- `exam_mode` value is the string `'true'` or `'false'` (not boolean) — `settings.value` is `text`
- `reservation_hold_minutes` must be between 5 and 120 (validated in action)
- `priority_min_duration_days` must be between 1 and 365 (validated in action)
- French UI labels only
- Run all commands from `/home/sah/Synapse`

---

### Task 1: Settings server actions

**Files:**
- Create: `apps/web/src/app/(admin-pages)/admin/settings/actions.ts`

- [ ] **Step 1: Write all three settings actions**

```typescript
// apps/web/src/app/(admin-pages)/admin/settings/actions.ts
'use server';

import { z } from 'zod';
import { adminActionClient } from '@/clients/action-clients';
import { createSupabaseServerClient } from '@/supabase-clients/server';
import { revalidatePath } from 'next/cache';

// ── 1. Toggle exam mode ───────────────────────────────────────
const setExamModeSchema = z.object({
  enabled: z.boolean(),
});

export const setExamMode = adminActionClient
  .schema(setExamModeSchema)
  .action(async ({ parsedInput: { enabled } }) => {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('settings')
      .upsert(
        { key: 'exam_mode', value: enabled ? 'true' : 'false' },
        { onConflict: 'key' }
      );

    if (error) throw new Error('Impossible de mettre à jour le mode examen.');

    revalidatePath('/admin/settings');
    return { success: true, examMode: enabled };
  });

// ── 2. Update reservation hold duration ──────────────────────
const setReservationHoldSchema = z.object({
  minutes: z
    .number()
    .int()
    .min(5, 'Minimum 5 minutes')
    .max(120, 'Maximum 120 minutes'),
});

export const setReservationHoldMinutes = adminActionClient
  .schema(setReservationHoldSchema)
  .action(async ({ parsedInput: { minutes } }) => {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('settings')
      .upsert(
        { key: 'reservation_hold_minutes', value: String(minutes) },
        { onConflict: 'key' }
      );

    if (error) throw new Error('Impossible de mettre à jour la durée de réservation.');

    revalidatePath('/admin/settings');
    return { success: true, minutes };
  });

// ── 3. Update priority subscription threshold ─────────────────
const setPriorityMinDaysSchema = z.object({
  days: z
    .number()
    .int()
    .min(1, 'Minimum 1 jour')
    .max(365, 'Maximum 365 jours'),
});

export const setPriorityMinDurationDays = adminActionClient
  .schema(setPriorityMinDaysSchema)
  .action(async ({ parsedInput: { days } }) => {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('settings')
      .upsert(
        { key: 'priority_min_duration_days', value: String(days) },
        { onConflict: 'key' }
      );

    if (error) throw new Error('Impossible de mettre à jour le seuil de priorité.');

    revalidatePath('/admin/settings');
    return { success: true, days };
  });
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(admin-pages\)/admin/settings/actions.ts
git commit -m "feat(admin-settings): server actions for exam mode, hold duration, priority threshold"
```

---

### Task 2: Exam mode toggle component

**Files:**
- Create: `apps/web/src/app/(admin-pages)/admin/settings/ExamModeCard.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/app/(admin-pages)/admin/settings/ExamModeCard.tsx
'use client';

import { useAction } from 'next-safe-action/hooks';
import { setExamMode } from './actions';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';

export function ExamModeCard({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);

  const { execute, isPending } = useAction(setExamMode, {
    onSuccess: ({ data }) => {
      if (!data?.success) return;
      setEnabled(data.examMode);
      toast.success(
        data.examMode
          ? 'Mode examen activé — réservation obligatoire pour l\'accès.'
          : 'Mode examen désactivé.'
      );
    },
    onError: ({ error }) => {
      // Revert optimistic toggle
      setEnabled((prev) => !prev);
      toast.error(error.serverError ?? 'Erreur lors de la mise à jour.');
    },
  });

  function handleToggle(checked: boolean) {
    setEnabled(checked); // optimistic
    execute({ enabled: checked });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mode examen</CardTitle>
        <CardDescription>
          Lorsqu'il est activé, une réservation préalable est obligatoire pour tout accès à l'espace.
          Les étudiants sans réservation active seront refusés au scan QR.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-medium text-sm">
              {enabled ? 'Activé' : 'Désactivé'}
            </span>
            <span className="text-xs text-muted-foreground">
              {enabled
                ? 'Les réservations sont obligatoires. File d\'attente active.'
                : 'Accès libre avec abonnement valide.'}
            </span>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={isPending}
            aria-label="Activer le mode examen"
          />
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(admin-pages\)/admin/settings/ExamModeCard.tsx
git commit -m "feat(admin-settings): exam mode toggle card"
```

---

### Task 3: Reservation hold duration card

**Files:**
- Create: `apps/web/src/app/(admin-pages)/admin/settings/ReservationHoldCard.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/app/(admin-pages)/admin/settings/ReservationHoldCard.tsx
'use client';

import { useAction } from 'next-safe-action/hooks';
import { setReservationHoldMinutes } from './actions';
import { toast } from 'sonner';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function ReservationHoldCard({ initialMinutes }: { initialMinutes: number }) {
  const [minutes, setMinutes] = useState(String(initialMinutes));
  const [validationError, setValidationError] = useState<string | null>(null);

  const { execute, isPending } = useAction(setReservationHoldMinutes, {
    onSuccess: ({ data }) => {
      if (!data?.success) return;
      toast.success(`Durée de réservation mise à jour : ${data.minutes} minutes.`);
      setValidationError(null);
    },
    onError: ({ error }) => {
      const msg =
        error.validationErrors?.minutes?._errors?.[0] ??
        error.serverError ??
        'Erreur lors de la mise à jour.';
      toast.error(msg);
      setValidationError(msg);
    },
  });

  function handleSave() {
    const parsed = parseInt(minutes, 10);
    if (isNaN(parsed) || parsed < 5 || parsed > 120) {
      setValidationError('La durée doit être entre 5 et 120 minutes.');
      return;
    }
    setValidationError(null);
    execute({ minutes: parsed });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Durée de réservation</CardTitle>
        <CardDescription>
          Durée pendant laquelle une réservation reste active avant expiration automatique.
          Entre 5 et 120 minutes.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-3 max-w-xs">
          <div className="flex-1">
            <Label htmlFor="hold-minutes" className="sr-only">
              Durée en minutes
            </Label>
            <Input
              id="hold-minutes"
              type="number"
              min={5}
              max={120}
              value={minutes}
              onChange={(e) => {
                setMinutes(e.target.value);
                setValidationError(null);
              }}
              disabled={isPending}
              className="w-full"
            />
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">minutes</span>
          <Button onClick={handleSave} disabled={isPending} size="sm">
            {isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
        {validationError && (
          <p className="text-xs text-red-500">{validationError}</p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(admin-pages\)/admin/settings/ReservationHoldCard.tsx
git commit -m "feat(admin-settings): reservation hold duration card"
```

---

### Task 4: Priority threshold card

**Files:**
- Create: `apps/web/src/app/(admin-pages)/admin/settings/PriorityThresholdCard.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/app/(admin-pages)/admin/settings/PriorityThresholdCard.tsx
'use client';

import { useAction } from 'next-safe-action/hooks';
import { setPriorityMinDurationDays } from './actions';
import { toast } from 'sonner';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function PriorityThresholdCard({ initialDays }: { initialDays: number }) {
  const [days, setDays] = useState(String(initialDays));
  const [validationError, setValidationError] = useState<string | null>(null);

  const { execute, isPending } = useAction(setPriorityMinDurationDays, {
    onSuccess: ({ data }) => {
      if (!data?.success) return;
      toast.success(`Seuil de priorité mis à jour : ${data.days} jours.`);
      setValidationError(null);
    },
    onError: ({ error }) => {
      const msg =
        error.validationErrors?.days?._errors?.[0] ??
        error.serverError ??
        'Erreur lors de la mise à jour.';
      toast.error(msg);
      setValidationError(msg);
    },
  });

  function handleSave() {
    const parsed = parseInt(days, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 365) {
      setValidationError('Le seuil doit être entre 1 et 365 jours.');
      return;
    }
    setValidationError(null);
    execute({ days: parsed });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seuil de priorité (mode examen)</CardTitle>
        <CardDescription>
          Les abonnements d'une durée supérieure ou égale à ce seuil sont considérés prioritaires
          en mode examen — ces étudiants passent devant les abonnements courts dans la file d'attente.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-3 max-w-xs">
          <div className="flex-1">
            <Label htmlFor="priority-days" className="sr-only">
              Seuil en jours
            </Label>
            <Input
              id="priority-days"
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => {
                setDays(e.target.value);
                setValidationError(null);
              }}
              disabled={isPending}
            />
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">jours</span>
          <Button onClick={handleSave} disabled={isPending} size="sm">
            {isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
        {validationError && (
          <p className="text-xs text-red-500">{validationError}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Exemple : valeur = 30 → les abonnements mensuels et au-delà sont prioritaires.
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(admin-pages\)/admin/settings/PriorityThresholdCard.tsx
git commit -m "feat(admin-settings): priority threshold card for exam mode"
```

---

### Task 5: Admin settings page (RSC)

**Files:**
- Create: `apps/web/src/app/(admin-pages)/admin/settings/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// apps/web/src/app/(admin-pages)/admin/settings/page.tsx
import { createSupabaseServerClient } from '@/supabase-clients/server';
import { ExamModeCard } from './ExamModeCard';
import { ReservationHoldCard } from './ReservationHoldCard';
import { PriorityThresholdCard } from './PriorityThresholdCard';

export const dynamic = 'force-dynamic';

async function getSetting(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  key: string,
  fallback: string
): Promise<string> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .single();
  return data?.value ?? fallback;
}

export default async function AdminSettingsPage() {
  const supabase = await createSupabaseServerClient();

  const [examModeValue, holdMinutesValue, priorityDaysValue] = await Promise.all([
    getSetting(supabase, 'exam_mode', 'false'),
    getSetting(supabase, 'reservation_hold_minutes', '30'),
    getSetting(supabase, 'priority_min_duration_days', '30'),
  ]);

  const examMode = examModeValue === 'true';
  const holdMinutes = parseInt(holdMinutesValue, 10);
  const priorityDays = parseInt(priorityDaysValue, 10);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configuration globale de l'espace Synapse.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Réservations</h2>
        <ReservationHoldCard initialMinutes={holdMinutes} />
        <ExamModeCard initialEnabled={examMode} />
        <PriorityThresholdCard initialDays={priorityDays} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify the page renders without TypeScript errors**

```bash
cd /home/sah/Synapse
pnpm --filter @synapse/web tsc --noEmit 2>&1 | grep -E "error TS|settings/page"
```

Expected output: no lines (zero TypeScript errors).

- [ ] **Step 3: Verify the route is accessible in dev**

```bash
pnpm --filter @synapse/web dev &
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin/settings
```

Expected output: `200` (or `307` redirect to login if not authenticated — both are correct).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(admin-pages\)/admin/settings/page.tsx
git commit -m "feat(admin-settings): settings page with exam mode, hold duration, priority threshold"
```

---

### Task 6: Add settings link to admin navigation

**Files:**
- Modify: `apps/web/src/app/(admin-pages)/` — locate the admin sidebar/nav component (likely `AdminSidebar.tsx`, `AdminNav.tsx`, or the layout file)

- [ ] **Step 1: Find the admin navigation component**

```bash
grep -rl "admin" /home/sah/Synapse/apps/web/src/app/\(admin-pages\)/ \
  --include="*.tsx" | head -10
```

- [ ] **Step 2: Add the settings link** alongside existing nav items:

```tsx
<NavLink href="/admin/settings">
  Paramètres
</NavLink>
```

(Use the existing `NavLink` or equivalent nav item component already used in that file.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(admin-pages\)/
git commit -m "feat(admin-nav): add Paramètres link to admin navigation"
```

---

## Self-Review — Spec Coverage

| Spec requirement | Covered |
|---|---|
| `/admin/settings` page | ✅ Task 5 |
| Exam mode toggle (admin-only) | ✅ Task 2 (`ExamModeCard`) + Task 1 (`setExamMode` action) |
| Reservation hold minutes input | ✅ Task 3 (`ReservationHoldCard`) + Task 1 (`setReservationHoldMinutes` action) |
| Priority min duration days input | ✅ Task 4 (`PriorityThresholdCard`) + Task 1 (`setPriorityMinDurationDays` action) |
| Settings UPSERT to `settings` table | ✅ Task 1 (all three actions use `upsert` with `onConflict: 'key'`) |
| `adminActionClient` only — no employee access | ✅ Task 1 (all actions use `adminActionClient`) |
| Validation: hold 5–120, priority 1–365 | ✅ Task 1 (Zod schemas) + Tasks 3–4 (client-side guard) |
| French UI labels throughout | ✅ All components |
| Optimistic toggle + toast feedback | ✅ Task 2 (`ExamModeCard` optimistic state) |
| Settings page linked in admin nav | ✅ Task 6 |
