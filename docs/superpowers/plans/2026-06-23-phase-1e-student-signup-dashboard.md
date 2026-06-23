# Phase 1E: Student Self-Signup & Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Students can self-register via a signup page. After login they see their active subscription status, expiry date, and days remaining on their dashboard.

**Architecture:** Self-signup uses `supabase.auth.signUp()` with full_name + phone passed in `options.data` — the `handle_new_user` trigger creates the profile automatically. The student dashboard is a Server Component that queries the student's active subscription directly. The QR code display is a placeholder (full implementation in Phase 2).

**Tech Stack:** next-safe-action, Zod, shadcn/ui, date-fns

## Global Constraints

- Depends on Plan 1A (profiles table + handle_new_user trigger), Plan 1B (student layout + middleware)
- Self-signup always creates role='student' (enforced by trigger)
- Student cannot see other students' data — RLS enforces this
- Student cannot cancel subscriptions — read-only subscription view
- French UI
- All commands from `/home/sah/Synapse`

---

### Task 1: Student signup Zod schema + action

**Files:**
- Create: `apps/web/src/utils/zod-schemas/auth.ts`
- Create: `apps/web/src/actions/auth/student-signup.ts`
- Create: `apps/web/src/actions/auth/student-signup.test.ts`

- [ ] **Step 1: Write auth Zod schema**

```typescript
// apps/web/src/utils/zod-schemas/auth.ts
import { z } from 'zod'

export const studentSignupSchema = z.object({
  full_name: z.string().min(2, 'Nom requis (min 2 caractères)'),
  email: z.string().email('Email invalide'),
  phone: z.string().min(8, 'Téléphone requis (min 8 chiffres)').optional().or(z.literal('')),
  university: z.string().optional().or(z.literal('')),
  study_level: z.string().optional().or(z.literal('')),
  password: z.string().min(8, 'Mot de passe minimum 8 caractères'),
  password_confirm: z.string(),
}).refine((data) => data.password === data.password_confirm, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['password_confirm'],
})

export type StudentSignupInput = z.infer<typeof studentSignupSchema>
```

- [ ] **Step 2: Write failing test**

```typescript
// apps/web/src/actions/auth/student-signup.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/safe-action', () => ({
  actionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn(),
  },
}))

vi.mock('@/supabase-clients/server', () => ({
  createSupabaseClient: vi.fn(),
}))

describe('studentSignupAction', () => {
  it('is defined', async () => {
    const { studentSignupAction } = await import('./student-signup')
    expect(studentSignupAction).toBeDefined()
  })
})
```

- [ ] **Step 3: Run failing test**

```bash
cd apps/web && pnpm test -- --reporter=verbose student-signup.test 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 4: Implement signup action**

```typescript
// apps/web/src/actions/auth/student-signup.ts
'use server'

import { actionClient } from '@/lib/safe-action'
import { studentSignupSchema } from '@/utils/zod-schemas/auth'
import { createSupabaseClient } from '@/supabase-clients/server'

export const studentSignupAction = actionClient
  .schema(studentSignupSchema)
  .action(async ({ parsedInput }) => {
    const { full_name, email, phone, university, study_level, password } = parsedInput
    const supabase = await createSupabaseClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          phone: phone || null,
          university: university || null,
          study_level: study_level || null,
        },
      },
    })

    if (error) throw new Error(error.message)

    // handle_new_user trigger creates the profile automatically
    // role defaults to 'student'

    return {
      userId: data.user?.id,
      // If email confirmation is required, user won't be logged in yet
      needsEmailConfirmation: !data.session,
    }
  })
```

- [ ] **Step 5: Run passing test**

```bash
cd apps/web && pnpm test -- --reporter=verbose student-signup.test
```

Expected: 1 passing.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/utils/zod-schemas/auth.ts \
        apps/web/src/actions/auth/student-signup.ts \
        apps/web/src/actions/auth/student-signup.test.ts
git commit -m "feat(auth): add student self-signup action"
```

---

### Task 2: Student signup page

**Files:**
- Modify: `apps/web/src/app/(auth-pages)/sign-up/page.tsx`
- Create: `apps/web/src/app/(auth-pages)/sign-up/StudentSignup.tsx`

- [ ] **Step 1: Create StudentSignup client component**

```typescript
// apps/web/src/app/(auth-pages)/sign-up/StudentSignup.tsx
'use client'

import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { studentSignupAction } from '@/actions/auth/student-signup'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { studentSignupSchema, type StudentSignupInput } from '@/utils/zod-schemas/auth'
import Link from 'next/link'
import { useState } from 'react'

export function StudentSignup() {
  const router = useRouter()
  const [emailConfirmPending, setEmailConfirmPending] = useState(false)

  const form = useForm<StudentSignupInput>({
    resolver: zodResolver(studentSignupSchema),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      university: '',
      study_level: '',
      password: '',
      password_confirm: '',
    },
  })

  const { execute, status } = useAction(studentSignupAction, {
    onSuccess: ({ data }) => {
      if (data?.needsEmailConfirmation) {
        setEmailConfirmPending(true)
      } else {
        toast.success('Compte créé avec succès')
        router.push('/student/dashboard')
      }
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur lors de la création du compte')
    },
  })

  if (emailConfirmPending) {
    return (
      <div className="max-w-md mx-auto p-6 space-y-4 text-center">
        <h2 className="text-xl font-semibold">Vérifiez votre email</h2>
        <p className="text-muted-foreground text-sm">
          Un lien de confirmation a été envoyé à <strong>{form.getValues('email')}</strong>.
          Cliquez sur le lien pour activer votre compte.
        </p>
        <Link href="/login" className="text-primary text-sm underline">
          Retour à la connexion
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Créer un compte</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Espace Synapse — étudiants uniquement
        </p>
      </div>

      <form onSubmit={form.handleSubmit((d) => execute(d))} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="full_name">Nom complet *</Label>
          <Input id="full_name" {...form.register('full_name')} />
          {form.formState.errors.full_name && (
            <p className="text-sm text-destructive">{form.formState.errors.full_name.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="email">Email *</Label>
          <Input id="email" type="email" {...form.register('email')} />
          {form.formState.errors.email && (
            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="phone">Téléphone</Label>
          <Input id="phone" {...form.register('phone')} placeholder="ex: 22 334 455" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="university">Université</Label>
          <Input id="university" {...form.register('university')} placeholder="ex: ISIMS, FSS" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="study_level">Niveau d'étude</Label>
          <Input id="study_level" {...form.register('study_level')} placeholder="ex: Licence 3" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="password">Mot de passe *</Label>
          <Input id="password" type="password" {...form.register('password')} />
          {form.formState.errors.password && (
            <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="password_confirm">Confirmer le mot de passe *</Label>
          <Input id="password_confirm" type="password" {...form.register('password_confirm')} />
          {form.formState.errors.password_confirm && (
            <p className="text-sm text-destructive">{form.formState.errors.password_confirm.message}</p>
          )}
        </div>

        <Button type="submit" disabled={status === 'executing'} className="w-full">
          {status === 'executing' ? 'Création...' : 'Créer mon compte'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Déjà inscrit ?{' '}
        <Link href="/login" className="text-primary underline">
          Se connecter
        </Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Update sign-up page**

```typescript
// apps/web/src/app/(auth-pages)/sign-up/page.tsx
import { StudentSignup } from './StudentSignup'

export default function SignUpPage() {
  return <StudentSignup />
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(auth-pages)/sign-up/
git commit -m "feat(auth): replace boilerplate signup with student self-registration"
```

---

### Task 3: Student data layer

**Files:**
- Create: `apps/web/src/data/student/profile.ts`

- [ ] **Step 1: Create student data functions**

```typescript
// apps/web/src/data/student/profile.ts
'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export async function getMyProfile() {
  const supabase = await createSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Non connecté')

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, university, study_level, qr_token, created_at')
    .eq('id', user.id)
    .single()

  if (error) throw error
  return data
}

export async function getMyActiveSubscription() {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('subscriptions')
    .select(`
      id, start_date, end_date, paid_amount,
      subscription_plans ( name, duration_days )
    `)
    .eq('student_id', user.id)
    .gte('end_date', today)
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

export async function getMyLoyaltyBalance() {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { data } = await supabase
    .from('loyalty_ledger')
    .select('points_delta')
    .eq('student_id', user.id)

  return data?.reduce((sum, row) => sum + row.points_delta, 0) ?? 0
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/data/student/profile.ts
git commit -m "feat(student): add student data layer for profile and subscription"
```

---

### Task 4: Student dashboard page

**Files:**
- Modify: `apps/web/src/app/student/dashboard/page.tsx`

- [ ] **Step 1: Implement dashboard**

```typescript
// apps/web/src/app/student/dashboard/page.tsx
import { getMyProfile, getMyActiveSubscription, getMyLoyaltyBalance } from '@/data/student/profile'
import { differenceInDays, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { format } from 'date-fns'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function StudentDashboardPage() {
  const [profile, activeSubscription, loyaltyBalance] = await Promise.all([
    getMyProfile(),
    getMyActiveSubscription(),
    getMyLoyaltyBalance(),
  ])

  const today = new Date()
  const daysRemaining = activeSubscription
    ? differenceInDays(parseISO(activeSubscription.end_date), today)
    : 0

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Bonjour, {profile.full_name.split(' ')[0]}</h1>
        <p className="text-muted-foreground text-sm">{profile.university ?? 'Synapse'}</p>
      </div>

      {/* Subscription card */}
      {activeSubscription ? (
        <div className={`rounded-xl p-5 text-white ${daysRemaining <= 3 ? 'bg-destructive' : 'bg-primary'}`}>
          <p className="text-xs uppercase tracking-wide opacity-75">Abonnement actif</p>
          <p className="text-2xl font-bold mt-1">
            {(activeSubscription.subscription_plans as { name: string })?.name}
          </p>
          <div className="mt-3 flex justify-between text-sm">
            <div>
              <p className="opacity-75 text-xs">Expire le</p>
              <p className="font-semibold">
                {format(parseISO(activeSubscription.end_date), 'dd MMMM yyyy', { locale: fr })}
              </p>
            </div>
            <div className="text-right">
              <p className="opacity-75 text-xs">Jours restants</p>
              <p className="font-bold text-2xl">{daysRemaining}</p>
            </div>
          </div>
          {daysRemaining <= 3 && (
            <p className="mt-2 text-xs opacity-90">
              ⚠️ Votre abonnement expire bientôt — contactez l'accueil pour renouveler
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed p-5 text-center space-y-2">
          <p className="font-medium">Aucun abonnement actif</p>
          <p className="text-muted-foreground text-sm">
            Rendez-vous à l'accueil pour souscrire à une formule
          </p>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Points Synapse</p>
          <p className="text-2xl font-bold mt-1">{loyaltyBalance}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Membre depuis</p>
          <p className="font-semibold mt-1 text-sm">
            {format(parseISO(profile.created_at), 'MMM yyyy', { locale: fr })}
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="space-y-2">
        <Button asChild variant="outline" className="w-full justify-start">
          <Link href="/student/qr">Mon QR Code</Link>
        </Button>
        <Button asChild variant="outline" className="w-full justify-start">
          <Link href="/student/loyalty">Mes récompenses</Link>
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create placeholder pages for bottom nav links (prevents 404)**

```typescript
// apps/web/src/app/student/qr/page.tsx
export default function StudentQrPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <h1 className="text-xl font-semibold">Mon QR Code</h1>
      <p className="text-muted-foreground text-sm text-center">
        Disponible en Phase 2 — présentez-vous à l'accueil
      </p>
    </div>
  )
}
```

```typescript
// apps/web/src/app/student/reservation/page.tsx
export default function StudentReservationPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <h1 className="text-xl font-semibold">Réserver une place</h1>
      <p className="text-muted-foreground text-sm text-center">
        Disponible en Phase 3
      </p>
    </div>
  )
}
```

```typescript
// apps/web/src/app/student/loyalty/page.tsx
import { getMyLoyaltyBalance } from '@/data/student/profile'

export default async function StudentLoyaltyPage() {
  const balance = await getMyLoyaltyBalance()

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Points Synapse</h1>
      <div className="rounded-xl bg-primary text-white p-6 text-center">
        <p className="text-xs opacity-75 uppercase tracking-wide">Solde actuel</p>
        <p className="text-5xl font-bold mt-2">{balance}</p>
        <p className="text-sm opacity-75 mt-1">points</p>
      </div>
      <p className="text-muted-foreground text-sm text-center">
        Les récompenses seront disponibles en Phase 5
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/student/
git commit -m "feat(student): implement student dashboard with subscription status and loyalty balance"
```

---

### Task 5: End-to-end smoke test

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Test student self-signup flow**

1. Open http://localhost:3000 → should redirect to http://localhost:3000/login
2. Click "Créer un compte" link (or navigate to /sign-up)
3. Fill form with test data: full_name="Test Étudiant", email (unused mailbox), phone="22334455", password="TestPass123!"
4. Submit → should see email confirmation pending screen OR redirect to /student/dashboard
5. If email confirmation is disabled in local Supabase config (default), should land at /student/dashboard
6. Verify dashboard shows "Bonjour, Test" and "Aucun abonnement actif"

- [ ] **Step 3: Test employee flow**

1. Seed an admin user in Supabase Studio (http://localhost:54323)
   - Create user in Auth → Users panel
   - Update profiles row: set role='admin'
2. Login at /login → should land at /admin/dashboard
3. Navigate to /admin/employees/new → create an employee
4. Login as employee → /employee/dashboard
5. Navigate to /employee/students/new → create a student
6. Navigate to that student → /employee/students/[id]
7. Click "Vendre abonnement" → select a plan → confirm
8. Verify student shows active subscription

- [ ] **Step 4: Verify role guards**

1. While logged in as employee, navigate to /admin/dashboard → should redirect to /employee/dashboard
2. While logged in as student, navigate to /employee/students → should redirect to /student/dashboard

- [ ] **Step 5: Commit smoke test completion note**

```bash
git commit --allow-empty -m "test: Phase 1 smoke test passed — auth, student CRUD, subscription sale verified"
```
