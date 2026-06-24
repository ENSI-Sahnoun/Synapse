# Admin CRUD — Edit / Archive / Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add edit, archive (soft delete), restore, hard delete, and subscription-editing capabilities to the admin panel for students, employees, and subscription plans.

**Architecture:** A DB migration adds `is_archived` to `profiles`. New server actions handle update/archive/restore/hard-delete. List pages gain row-level action buttons (small Client Components) and an `?archived=1` URL toggle. Edit pages reuse existing form patterns. A `SubscriptionEditor` Client Component on the student detail page allows admins to modify active subscriptions.

**Tech Stack:** Next.js App Router (RSC + Client Components), next-safe-action (`adminActionClient`), Supabase admin client, react-hook-form + zod, sonner (toasts), `date-fns`

## Global Constraints

- `adminActionClient` for all new admin server actions
- `createSupabaseAdminClient()` for auth operations (ban/delete/update auth users)
- French UI — all labels, messages, and toasts in French
- `revalidatePath` after every mutation
- Migration timestamp must be after `20260623000012` — use `20260624000001`
- All commands from `/home/sah/Synapse`
- Build must pass: `pnpm --filter=web build`
- Typecheck before committing: `cd apps/web && npx tsc --noEmit`

---

### Task 1: Migration — add `is_archived` to profiles

**Files:**
- Create: `apps/database/supabase/migrations/20260624000001_smp_profiles_is_archived.sql`

**Interfaces:**
- Produces: `profiles.is_archived boolean not null default false` column available in all subsequent tasks

- [ ] **Step 1: Write the migration**

```sql
-- apps/database/supabase/migrations/20260624000001_smp_profiles_is_archived.sql
alter table public.profiles
  add column if not exists is_archived boolean not null default false;

comment on column public.profiles.is_archived is
  'Soft-delete flag. Archived users cannot log in (Supabase ban). Data is preserved.';
```

- [ ] **Step 2: Apply migration**

```bash
supabase db push --local
```

Expected: migration applied, no errors.

- [ ] **Step 3: Regenerate types**

```bash
cd /home/sah/Synapse && supabase gen types typescript --local > apps/web/src/lib/database.types.ts
```

Expected: `database.types.ts` now includes `is_archived: boolean` in profiles Row/Insert/Update.

- [ ] **Step 4: Commit**

```bash
git add apps/database/supabase/migrations/20260624000001_smp_profiles_is_archived.sql apps/web/src/lib/database.types.ts
git commit -m "feat(db): add is_archived soft-delete column to profiles"
```

---

### Task 2: Data layer — update queries and add helpers

**Files:**
- Modify: `apps/web/src/data/admin/students.ts`
- Modify: `apps/web/src/data/employee/students.ts`

**Interfaces:**
- Produces:
  - `listAllProfiles(role?, showArchived?)` — filters `is_archived` unless `showArchived=true`
  - `getProfileById(id)` — single profile row
  - `getStudentWithSubscription(id)` — profile + active subscription + all active plans

- [ ] **Step 1: Update `apps/web/src/data/admin/students.ts`**

Replace the entire file:

```typescript
'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export async function listAllProfiles(
  role?: 'student' | 'employee' | 'admin',
  showArchived = false
) {
  const supabase = await createSupabaseClient()
  let query = supabase
    .from('profiles')
    .select('id, full_name, phone, role, university, study_level, is_archived, created_at')
    .order('created_at', { ascending: false })

  if (role) query = query.eq('role', role)
  query = query.eq('is_archived', showArchived)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getProfileById(id: string) {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, role, university, study_level, is_archived, created_at')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function getStudentWithSubscription(id: string) {
  const supabase = await createSupabaseClient()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, phone, university, study_level, is_archived')
    .eq('id', id)
    .eq('role', 'student')
    .single()
  if (profileError) throw profileError

  const today = new Date().toISOString().split('T')[0]

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, start_date, end_date, paid_amount, plan_id, subscription_plans(id, name, duration_days, price_dt)')
    .eq('student_id', id)
    .gte('end_date', today)
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('id, name, duration_days, price_dt')
    .eq('is_active', true)
    .order('price_dt', { ascending: true })

  return { profile, subscription, plans: plans ?? [] }
}
```

- [ ] **Step 2: Update `apps/web/src/data/employee/students.ts` to filter archived**

In `listStudents`, add `.eq('is_archived', false)` after `.eq('role', 'student')`:

```typescript
// In listStudents(), after .eq('role', 'student'):
    .eq('is_archived', false)
```

In `getStudentById`, add `.eq('is_archived', false)` after `.eq('role', 'student')`:

```typescript
// In getStudentById(), after .eq('role', 'student'):
    .eq('is_archived', false)
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/data/admin/students.ts apps/web/src/data/employee/students.ts
git commit -m "feat(data): filter archived profiles from lists, add admin data helpers"
```

---

### Task 3: Admin student + user actions (update / archive / restore / hard delete)

**Files:**
- Create: `apps/web/src/actions/admin/students.ts`

**Interfaces:**
- Consumes: `adminActionClient` from `@/lib/safe-action`, `createSupabaseAdminClient` from `@/supabase-clients/admin`
- Produces:
  - `updateStudentAction({ id, full_name?, phone?, university?, study_level? })`
  - `archiveUserAction({ id })` — sets `is_archived=true`, bans auth user for 87600h
  - `restoreUserAction({ id })` — sets `is_archived=false`, removes ban
  - `hardDeleteUserAction({ id })` — deletes auth user (cascades profile + data)

- [ ] **Step 1: Create `apps/web/src/actions/admin/students.ts`**

```typescript
'use server'

import { adminActionClient } from '@/lib/safe-action'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { createSupabaseClient } from '@/supabase-clients/server'
import { updateStudentSchema } from '@/utils/zod-schemas/student'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const userIdSchema = z.object({ id: z.string().uuid() })

export const updateStudentAction = adminActionClient
  .schema(updateStudentSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...updates } = parsedInput
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/students')
    revalidatePath(`/admin/students/${id}`)
    return { success: true }
  })

export const archiveUserAction = adminActionClient
  .schema(userIdSchema)
  .action(async ({ parsedInput }) => {
    const { id } = parsedInput
    const adminSupabase = createSupabaseAdminClient()

    const { error: banError } = await adminSupabase.auth.admin.updateUserById(id, {
      ban_duration: '87600h',
    })
    if (banError) throw new Error(`Erreur désactivation: ${banError.message}`)

    const { error: profileError } = await adminSupabase
      .from('profiles')
      .update({ is_archived: true })
      .eq('id', id)
    if (profileError) throw new Error(`Erreur profil: ${profileError.message}`)

    revalidatePath('/admin/students')
    revalidatePath('/admin/employees')
    return { success: true }
  })

export const restoreUserAction = adminActionClient
  .schema(userIdSchema)
  .action(async ({ parsedInput }) => {
    const { id } = parsedInput
    const adminSupabase = createSupabaseAdminClient()

    const { error: unbanError } = await adminSupabase.auth.admin.updateUserById(id, {
      ban_duration: 'none',
    })
    if (unbanError) throw new Error(`Erreur restauration: ${unbanError.message}`)

    const { error: profileError } = await adminSupabase
      .from('profiles')
      .update({ is_archived: false })
      .eq('id', id)
    if (profileError) throw new Error(`Erreur profil: ${profileError.message}`)

    revalidatePath('/admin/students')
    revalidatePath('/admin/employees')
    return { success: true }
  })

export const hardDeleteUserAction = adminActionClient
  .schema(userIdSchema)
  .action(async ({ parsedInput }) => {
    const { id } = parsedInput
    const adminSupabase = createSupabaseAdminClient()

    const { error } = await adminSupabase.auth.admin.deleteUser(id)
    if (error) throw new Error(`Erreur suppression: ${error.message}`)

    revalidatePath('/admin/students')
    revalidatePath('/admin/employees')
    return { success: true }
  })
```

- [ ] **Step 2: Add `updateEmployeeAction` to `apps/web/src/actions/admin/employees.ts`**

Append to existing file:

```typescript
const updateEmployeeSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(2, 'Nom requis').optional(),
  phone: z.string().optional(),
})

export const updateEmployeeAction = adminActionClient
  .schema(updateEmployeeSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...updates } = parsedInput
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/employees')
    revalidatePath(`/admin/employees/${id}/edit`)
    return { success: true }
  })
```

Also add `import { createSupabaseClient } from '@/supabase-clients/server'` to the imports in that file.

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/actions/admin/students.ts apps/web/src/actions/admin/employees.ts
git commit -m "feat(actions): add admin update/archive/restore/hardDelete for users"
```

---

### Task 4: Admin subscription update action

**Files:**
- Create: `apps/web/src/actions/admin/subscriptions.ts`
- Modify: `apps/web/src/utils/zod-schemas/subscription.ts`

**Interfaces:**
- Produces: `adminUpdateSubscriptionAction({ subscription_id, end_date?, plan_id?, cancel? })`
  - `cancel: true` sets `end_date` to yesterday

- [ ] **Step 1: Add update schema to `apps/web/src/utils/zod-schemas/subscription.ts`**

Append to existing file:

```typescript
export const adminUpdateSubscriptionSchema = z.object({
  subscription_id: z.string().uuid(),
  end_date: z.string().date().optional(),
  plan_id: z.string().uuid().optional(),
  cancel: z.boolean().optional(),
})

export type AdminUpdateSubscriptionInput = z.infer<typeof adminUpdateSubscriptionSchema>
```

- [ ] **Step 2: Create `apps/web/src/actions/admin/subscriptions.ts`**

```typescript
'use server'

import { adminActionClient } from '@/lib/safe-action'
import { adminUpdateSubscriptionSchema } from '@/utils/zod-schemas/subscription'
import { createSupabaseClient } from '@/supabase-clients/server'
import { subDays, format } from 'date-fns'
import { revalidatePath } from 'next/cache'

export const adminUpdateSubscriptionAction = adminActionClient
  .schema(adminUpdateSubscriptionSchema)
  .action(async ({ parsedInput }) => {
    const { subscription_id, end_date, plan_id, cancel } = parsedInput
    const supabase = await createSupabaseClient()

    const updates: Record<string, string> = {}

    if (cancel) {
      updates.end_date = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    } else {
      if (end_date) updates.end_date = end_date
      if (plan_id) updates.plan_id = plan_id
    }

    if (Object.keys(updates).length === 0) return { success: true }

    const { data: sub, error: fetchError } = await supabase
      .from('subscriptions')
      .select('student_id')
      .eq('id', subscription_id)
      .single()
    if (fetchError || !sub) throw new Error('Abonnement introuvable')

    const { error } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', subscription_id)
    if (error) throw new Error(error.message)

    revalidatePath(`/admin/students/${sub.student_id}`)
    revalidatePath(`/employee/students/${sub.student_id}`)
    return { success: true }
  })
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/actions/admin/subscriptions.ts apps/web/src/utils/zod-schemas/subscription.ts
git commit -m "feat(actions): add adminUpdateSubscriptionAction for end_date/plan swap/cancel"
```

---

### Task 5: Shared admin action button components

**Files:**
- Create: `apps/web/src/components/admin/ArchiveButton.tsx`
- Create: `apps/web/src/components/admin/RestoreButton.tsx`
- Create: `apps/web/src/components/admin/HardDeleteButton.tsx`

**Interfaces:**
- Consumes: `archiveUserAction`, `restoreUserAction`, `hardDeleteUserAction` from Task 3
- Produces: three Client Components used in list pages and detail pages

- [ ] **Step 1: Create `apps/web/src/components/admin/ArchiveButton.tsx`**

```typescript
'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { archiveUserAction } from '@/actions/admin/students'

interface ArchiveButtonProps {
  id: string
  label?: string
}

export function ArchiveButton({ id, label = 'Archiver' }: ArchiveButtonProps) {
  const { execute, status } = useAction(archiveUserAction, {
    onSuccess: () => toast.success('Utilisateur archivé'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  function handleClick() {
    if (!window.confirm('Archiver cet utilisateur ? Il ne pourra plus se connecter.')) return
    execute({ id })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={status === 'executing'}
      className="text-orange-600 border-orange-200 hover:bg-orange-50"
    >
      {status === 'executing' ? '…' : label}
    </Button>
  )
}
```

- [ ] **Step 2: Create `apps/web/src/components/admin/RestoreButton.tsx`**

```typescript
'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { restoreUserAction } from '@/actions/admin/students'

interface RestoreButtonProps {
  id: string
}

export function RestoreButton({ id }: RestoreButtonProps) {
  const { execute, status } = useAction(restoreUserAction, {
    onSuccess: () => toast.success('Utilisateur restauré'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => execute({ id })}
      disabled={status === 'executing'}
      className="text-green-600 border-green-200 hover:bg-green-50"
    >
      {status === 'executing' ? '…' : 'Restaurer'}
    </Button>
  )
}
```

- [ ] **Step 3: Create `apps/web/src/components/admin/HardDeleteButton.tsx`**

```typescript
'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { hardDeleteUserAction } from '@/actions/admin/students'

interface HardDeleteButtonProps {
  id: string
  name: string
}

export function HardDeleteButton({ id, name }: HardDeleteButtonProps) {
  const { execute, status } = useAction(hardDeleteUserAction, {
    onSuccess: () => toast.success('Utilisateur supprimé définitivement'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  function handleClick() {
    const confirmed = window.confirm(
      `Supprimer définitivement "${name}" ?\n\nCette action est IRRÉVERSIBLE. Toutes les données (présences, abonnements) seront perdues.`
    )
    if (!confirmed) return
    execute({ id })
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleClick}
      disabled={status === 'executing'}
    >
      {status === 'executing' ? '…' : 'Supprimer'}
    </Button>
  )
}
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/admin/
git commit -m "feat(components): add ArchiveButton, RestoreButton, HardDeleteButton"
```

---

### Task 6: Student list page — row actions + archived toggle

**Files:**
- Modify: `apps/web/src/app/admin/students/page.tsx`
- Create: `apps/web/src/app/admin/students/ArchivedToggle.tsx`

**Interfaces:**
- Consumes: `listAllProfiles` (Task 2), `ArchiveButton`, `RestoreButton`, `HardDeleteButton` (Task 5)
- Produces: student list with Edit/Archive per row; archived view with Restore/Delete per row

- [ ] **Step 1: Create `apps/web/src/app/admin/students/ArchivedToggle.tsx`**

```typescript
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function ArchivedToggle() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const showArchived = searchParams.get('archived') === '1'

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => router.push(showArchived ? '/admin/students' : '/admin/students?archived=1')}
    >
      {showArchived ? 'Afficher actifs' : 'Afficher archivés'}
    </Button>
  )
}
```

- [ ] **Step 2: Replace `apps/web/src/app/admin/students/page.tsx`**

```typescript
import { listAllProfiles } from '@/data/admin/students'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArchiveButton } from '@/components/admin/ArchiveButton'
import { RestoreButton } from '@/components/admin/RestoreButton'
import { HardDeleteButton } from '@/components/admin/HardDeleteButton'
import { ArchivedToggle } from './ArchivedToggle'
import { Suspense } from 'react'

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const params = await searchParams
  const showArchived = params.archived === '1'
  const students = await listAllProfiles('student', showArchived)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Étudiants{showArchived ? ' — Archivés' : ''}
        </h1>
        <div className="flex gap-2">
          <Suspense><ArchivedToggle /></Suspense>
          {!showArchived && (
            <Button asChild>
              <Link href="/admin/students/new">Nouvel étudiant</Link>
            </Button>
          )}
        </div>
      </div>
      <p className="text-muted-foreground text-sm">{students.length} étudiant(s)</p>
      <div className="border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2">Nom</th>
              <th className="text-left px-4 py-2">Téléphone</th>
              <th className="text-left px-4 py-2">Université</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-muted-foreground">
                  {showArchived ? 'Aucun étudiant archivé' : 'Aucun étudiant'}
                </td>
              </tr>
            )}
            {students.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/admin/students/${s.id}`} className="hover:underline font-medium">
                    {s.full_name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{s.phone ?? '—'}</td>
                <td className="px-4 py-2 text-muted-foreground">{s.university ?? '—'}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-2 justify-end">
                    {showArchived ? (
                      <>
                        <RestoreButton id={s.id} />
                        <HardDeleteButton id={s.id} name={s.full_name} />
                      </>
                    ) : (
                      <>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/students/${s.id}/edit`}>Modifier</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/students/${s.id}`}>Abonnement</Link>
                        </Button>
                        <ArchiveButton id={s.id} />
                      </>
                    )}
                  </div>
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

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/admin/students/
git commit -m "feat(admin): add row actions and archived toggle to student list"
```

---

### Task 7: Student edit page

**Files:**
- Create: `apps/web/src/app/admin/students/[id]/edit/page.tsx`
- Create: `apps/web/src/components/students/EditStudentForm.tsx`

**Interfaces:**
- Consumes: `updateStudentAction` (Task 3), `getProfileById` (Task 2), `updateStudentSchema` from zod-schemas
- Produces: `/admin/students/[id]/edit` page

- [ ] **Step 1: Create `apps/web/src/components/students/EditStudentForm.tsx`**

```typescript
'use client'

import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateStudentAction } from '@/actions/admin/students'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateStudentSchema, type UpdateStudentInput } from '@/utils/zod-schemas/student'

interface EditStudentFormProps {
  student: {
    id: string
    full_name: string
    phone: string | null
    university: string | null
    study_level: string | null
  }
  redirectTo: string
}

export function EditStudentForm({ student, redirectTo }: EditStudentFormProps) {
  const router = useRouter()
  const form = useForm<UpdateStudentInput>({
    resolver: zodResolver(updateStudentSchema) as any,
    defaultValues: {
      id: student.id,
      full_name: student.full_name,
      phone: student.phone ?? '',
      university: student.university ?? '',
      study_level: student.study_level ?? '',
    },
  })

  const { execute, status } = useAction(updateStudentAction, {
    onSuccess: () => {
      toast.success('Étudiant mis à jour')
      router.push(redirectTo)
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <form onSubmit={form.handleSubmit((data) => execute(data))} className="space-y-4 max-w-md">
      <input type="hidden" {...form.register('id')} />

      <div className="space-y-1">
        <Label htmlFor="full_name">Nom complet *</Label>
        <Input id="full_name" {...form.register('full_name')} />
        {form.formState.errors.full_name && (
          <p className="text-sm text-destructive">{form.formState.errors.full_name.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="phone">Téléphone</Label>
        <Input id="phone" {...form.register('phone')} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="university">Université</Label>
        <Input id="university" {...form.register('university')} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="study_level">Niveau d&apos;étude</Label>
        <Input id="study_level" {...form.register('study_level')} placeholder="ex: Licence 3, Master 1" />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={status === 'executing'}>
          {status === 'executing' ? 'Sauvegarde...' : 'Enregistrer'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(redirectTo)}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Create `apps/web/src/app/admin/students/[id]/edit/page.tsx`**

```typescript
import { getProfileById } from '@/data/admin/students'
import { EditStudentForm } from '@/components/students/EditStudentForm'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function AdminEditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const profile = await getProfileById(id).catch(() => null)

  if (!profile || profile.role !== 'student') notFound()

  return (
    <div className="space-y-4">
      <Link href="/admin/students" className="text-sm text-muted-foreground hover:underline">
        ← Étudiants
      </Link>
      <h1 className="text-2xl font-semibold">Modifier — {profile.full_name}</h1>
      <EditStudentForm student={profile} redirectTo="/admin/students" />
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
git add apps/web/src/components/students/EditStudentForm.tsx apps/web/src/app/admin/students/
git commit -m "feat(admin): add student edit page with prefilled form"
```

---

### Task 8: Student detail page + SubscriptionEditor

**Files:**
- Create: `apps/web/src/app/admin/students/[id]/page.tsx`
- Create: `apps/web/src/components/admin/SubscriptionEditor.tsx`

**Interfaces:**
- Consumes: `getStudentWithSubscription` (Task 2), `adminUpdateSubscriptionAction` (Task 4)
- Produces: `/admin/students/[id]` page showing profile info + subscription editor

- [ ] **Step 1: Create `apps/web/src/components/admin/SubscriptionEditor.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { adminUpdateSubscriptionAction } from '@/actions/admin/subscriptions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Plan {
  id: string
  name: string
  duration_days: number
  price_dt: number
}

interface ActiveSubscription {
  id: string
  start_date: string
  end_date: string
  paid_amount: number
  plan_id: string
  subscription_plans: { id: string; name: string; duration_days: number; price_dt: number } | null
}

interface SubscriptionEditorProps {
  subscription: ActiveSubscription | null
  plans: Plan[]
  studentId: string
}

export function SubscriptionEditor({ subscription, plans, studentId }: SubscriptionEditorProps) {
  const [newEndDate, setNewEndDate] = useState(subscription?.end_date ?? '')
  const [newPlanId, setNewPlanId] = useState(subscription?.plan_id ?? '')

  const { execute, status } = useAction(adminUpdateSubscriptionAction, {
    onSuccess: () => toast.success('Abonnement mis à jour'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  if (!subscription) {
    return (
      <div className="rounded-md border p-4 text-sm text-muted-foreground">
        Aucun abonnement actif.{' '}
        <a href={`/employee/students/${studentId}`} className="underline">
          Ajouter via l&apos;interface employé
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-md">
      <div className="rounded-md border p-4 space-y-1 text-sm bg-muted/30">
        <p className="font-medium">{subscription.subscription_plans?.name ?? '—'}</p>
        <p className="text-muted-foreground">
          Du {format(parseISO(subscription.start_date), 'dd MMM yyyy', { locale: fr })} au{' '}
          {format(parseISO(subscription.end_date), 'dd MMM yyyy', { locale: fr })}
        </p>
        <p className="text-muted-foreground">Payé : {subscription.paid_amount} DT</p>
      </div>

      <div className="space-y-1">
        <Label>Changer la formule</Label>
        <select
          value={newPlanId}
          onChange={(e) => setNewPlanId(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm bg-background"
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.duration_days}j — {p.price_dt} DT
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label>Modifier la date de fin</Label>
        <Input
          type="date"
          value={newEndDate}
          onChange={(e) => setNewEndDate(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() =>
            execute({
              subscription_id: subscription.id,
              end_date: newEndDate !== subscription.end_date ? newEndDate : undefined,
              plan_id: newPlanId !== subscription.plan_id ? newPlanId : undefined,
            })
          }
          disabled={status === 'executing'}
        >
          {status === 'executing' ? 'Sauvegarde...' : 'Enregistrer'}
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            if (!window.confirm('Annuler cet abonnement ? Il expirera immédiatement.')) return
            execute({ subscription_id: subscription.id, cancel: true })
          }}
          disabled={status === 'executing'}
        >
          Annuler l&apos;abonnement
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `apps/web/src/app/admin/students/[id]/page.tsx`**

```typescript
import { getStudentWithSubscription } from '@/data/admin/students'
import { SubscriptionEditor } from '@/components/admin/SubscriptionEditor'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getStudentWithSubscription(id).catch(() => null)
  if (!result) notFound()

  const { profile, subscription, plans } = result

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/students" className="text-sm text-muted-foreground hover:underline">
          ← Étudiants
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{profile.full_name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {profile.phone ?? '—'} · {profile.university ?? '—'} · {profile.study_level ?? '—'}
          </p>
        </div>
        <Link
          href={`/admin/students/${id}/edit`}
          className="text-sm underline text-muted-foreground"
        >
          Modifier le profil
        </Link>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-medium">Abonnement actif</h2>
        <SubscriptionEditor
          subscription={subscription as any}
          plans={plans}
          studentId={id}
        />
      </div>
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
git add apps/web/src/components/admin/SubscriptionEditor.tsx apps/web/src/app/admin/students/[id]/page.tsx
git commit -m "feat(admin): add student detail page with subscription editor"
```

---

### Task 9: Employee list — row actions + employee edit page

**Files:**
- Modify: `apps/web/src/app/admin/employees/page.tsx`
- Create: `apps/web/src/app/admin/employees/[id]/edit/page.tsx`
- Create: `apps/web/src/components/admin/EditEmployeeForm.tsx`

**Interfaces:**
- Consumes: `listAllProfiles` (Task 2), `updateEmployeeAction` (Task 3), `ArchiveButton`/`RestoreButton`/`HardDeleteButton` (Task 5)
- Produces: employee list with Edit/Archive/Restore/Delete; employee edit route

- [ ] **Step 1: Create `apps/web/src/app/admin/employees/ArchivedToggle.tsx`**

```typescript
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function ArchivedToggle() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const showArchived = searchParams.get('archived') === '1'

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => router.push(showArchived ? '/admin/employees' : '/admin/employees?archived=1')}
    >
      {showArchived ? 'Afficher actifs' : 'Afficher archivés'}
    </Button>
  )
}
```

- [ ] **Step 2: Replace `apps/web/src/app/admin/employees/page.tsx`**

```typescript
import { listAllProfiles } from '@/data/admin/students'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArchiveButton } from '@/components/admin/ArchiveButton'
import { RestoreButton } from '@/components/admin/RestoreButton'
import { HardDeleteButton } from '@/components/admin/HardDeleteButton'
import { ArchivedToggle } from './ArchivedToggle'
import { Suspense } from 'react'

export default async function AdminEmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const params = await searchParams
  const showArchived = params.archived === '1'
  const employees = await listAllProfiles('employee', showArchived)

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 mb-6">
        <p className="font-medium">Configuration du kiosque d&apos;accès</p>
        <p className="mt-1 text-xs">
          Créez un compte employé dédié (ex. <code>kiosk@synapse.tn</code>), puis
          rendez-vous sur l&apos;appareil kiosque et connectez-vous via{' '}
          <strong>/kiosk/setup</strong>. Le kiosque restera connecté en permanence.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Employés{showArchived ? ' — Archivés' : ''}
        </h1>
        <div className="flex gap-2">
          <Suspense><ArchivedToggle /></Suspense>
          {!showArchived && (
            <Button asChild>
              <Link href="/admin/employees/new">Nouvel employé</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2">Nom</th>
              <th className="text-left px-4 py-2">Téléphone</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-8 text-muted-foreground">
                  {showArchived ? 'Aucun employé archivé' : 'Aucun employé'}
                </td>
              </tr>
            )}
            {employees.map((e) => (
              <tr key={e.id} className="border-b last:border-0">
                <td className="px-4 py-2">{e.full_name}</td>
                <td className="px-4 py-2 text-muted-foreground">{e.phone ?? '—'}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-2 justify-end">
                    {showArchived ? (
                      <>
                        <RestoreButton id={e.id} />
                        <HardDeleteButton id={e.id} name={e.full_name} />
                      </>
                    ) : (
                      <>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/employees/${e.id}/edit`}>Modifier</Link>
                        </Button>
                        <ArchiveButton id={e.id} />
                      </>
                    )}
                  </div>
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

- [ ] **Step 3: Create `apps/web/src/components/admin/EditEmployeeForm.tsx`**

```typescript
'use client'

import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateEmployeeAction } from '@/actions/admin/employees'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const schema = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(2, 'Nom requis'),
  phone: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

interface EditEmployeeFormProps {
  employee: { id: string; full_name: string; phone: string | null }
  redirectTo: string
}

export function EditEmployeeForm({ employee, redirectTo }: EditEmployeeFormProps) {
  const router = useRouter()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      id: employee.id,
      full_name: employee.full_name,
      phone: employee.phone ?? '',
    },
  })

  const { execute, status } = useAction(updateEmployeeAction, {
    onSuccess: () => {
      toast.success('Employé mis à jour')
      router.push(redirectTo)
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <form onSubmit={form.handleSubmit((data) => execute(data))} className="space-y-4 max-w-md">
      <input type="hidden" {...form.register('id')} />

      <div className="space-y-1">
        <Label htmlFor="full_name">Nom complet *</Label>
        <Input id="full_name" {...form.register('full_name')} />
        {form.formState.errors.full_name && (
          <p className="text-sm text-destructive">{form.formState.errors.full_name.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="phone">Téléphone</Label>
        <Input id="phone" {...form.register('phone')} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={status === 'executing'}>
          {status === 'executing' ? 'Sauvegarde...' : 'Enregistrer'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(redirectTo)}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Create `apps/web/src/app/admin/employees/[id]/edit/page.tsx`**

```typescript
import { getProfileById } from '@/data/admin/students'
import { EditEmployeeForm } from '@/components/admin/EditEmployeeForm'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function AdminEditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const profile = await getProfileById(id).catch(() => null)

  if (!profile || profile.role !== 'employee') notFound()

  return (
    <div className="space-y-4">
      <Link href="/admin/employees" className="text-sm text-muted-foreground hover:underline">
        ← Employés
      </Link>
      <h1 className="text-2xl font-semibold">Modifier — {profile.full_name}</h1>
      <EditEmployeeForm employee={profile} redirectTo="/admin/employees" />
    </div>
  )
}
```

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/admin/employees/ apps/web/src/components/admin/EditEmployeeForm.tsx
git commit -m "feat(admin): add employee list row actions and employee edit page"
```

---

### Task 10: Subscription plan edit page

**Files:**
- Create: `apps/web/src/app/admin/subscription-plans/[id]/edit/page.tsx`
- Modify: `apps/web/src/app/admin/subscription-plans/page.tsx`

**Interfaces:**
- Consumes: `updatePlanAction` from `@/actions/admin/subscription-plans` (already exists), `listSubscriptionPlans` from `@/data/admin/subscription-plans`
- Produces: `/admin/subscription-plans/[id]/edit` page; Edit button per row in plan list

- [ ] **Step 1: Check what `listSubscriptionPlans` returns**

```bash
cat apps/web/src/data/admin/subscription-plans.ts
```

Note the fields returned (id, name, duration_days, price_dt, is_active).

- [ ] **Step 2: Create `apps/web/src/app/admin/subscription-plans/[id]/edit/page.tsx`**

```typescript
'use client'

import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updatePlanAction } from '@/actions/admin/subscription-plans'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createSubscriptionPlanSchema, type CreateSubscriptionPlanInput } from '@/utils/zod-schemas/subscription-plan'
import Link from 'next/link'
import { use } from 'react'
```

Wait — this page needs to fetch the plan server-side and then render a client form. Since this is an App Router page, it should be a server component that fetches data and passes it to a client form. Let me restructure:

Create `apps/web/src/app/admin/subscription-plans/[id]/edit/page.tsx` as a **Server Component**:

```typescript
import { createSupabaseClient } from '@/supabase-clients/server'
import { notFound } from 'next/navigation'
import { EditPlanForm } from './EditPlanForm'
import Link from 'next/link'

export default async function EditSubscriptionPlanPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSupabaseClient()
  const { data: plan, error } = await supabase
    .from('subscription_plans')
    .select('id, name, duration_days, price_dt, is_active')
    .eq('id', id)
    .single()

  if (error || !plan) notFound()

  return (
    <div className="space-y-4">
      <Link href="/admin/subscription-plans" className="text-sm text-muted-foreground hover:underline">
        ← Formules
      </Link>
      <h1 className="text-2xl font-semibold">Modifier — {plan.name}</h1>
      <EditPlanForm plan={plan} />
    </div>
  )
}
```

- [ ] **Step 3: Create `apps/web/src/app/admin/subscription-plans/[id]/edit/EditPlanForm.tsx`**

```typescript
'use client'

import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updatePlanAction } from '@/actions/admin/subscription-plans'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateSubscriptionPlanSchema } from '@/utils/zod-schemas/subscription-plan'
import { z } from 'zod'

type FormValues = {
  id: string
  name: string
  duration_days: number
  price_dt: number
}

interface EditPlanFormProps {
  plan: { id: string; name: string; duration_days: number; price_dt: number }
}

export function EditPlanForm({ plan }: EditPlanFormProps) {
  const router = useRouter()
  const form = useForm<FormValues>({
    defaultValues: {
      id: plan.id,
      name: plan.name,
      duration_days: plan.duration_days,
      price_dt: plan.price_dt,
    },
  })

  const { execute, status } = useAction(updatePlanAction, {
    onSuccess: () => {
      toast.success('Formule mise à jour')
      router.push('/admin/subscription-plans')
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <form onSubmit={form.handleSubmit((data) => execute(data))} className="space-y-4 max-w-sm">
      <input type="hidden" {...form.register('id')} />

      <div className="space-y-1">
        <Label>Nom *</Label>
        <Input {...form.register('name')} placeholder="ex: Mensuel" />
      </div>

      <div className="space-y-1">
        <Label>Durée (jours) *</Label>
        <Input type="number" {...form.register('duration_days', { valueAsNumber: true })} />
      </div>

      <div className="space-y-1">
        <Label>Prix (DT) *</Label>
        <Input type="number" step="0.5" {...form.register('price_dt', { valueAsNumber: true })} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={status === 'executing'}>
          {status === 'executing' ? 'Sauvegarde...' : 'Enregistrer'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/admin/subscription-plans')}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Add Edit button to subscription plan list**

In `apps/web/src/app/admin/subscription-plans/page.tsx`, update the last `<td>` to include an edit link before `TogglePlanButton`:

```typescript
// Add this import at the top:
import Link from 'next/link'

// Replace the last <td> in the table row:
<td className="px-4 py-2">
  <div className="flex gap-2 justify-end">
    <Button asChild variant="outline" size="sm">
      <Link href={`/admin/subscription-plans/${plan.id}/edit`}>Modifier</Link>
    </Button>
    <TogglePlanButton id={plan.id} isActive={plan.is_active} />
  </div>
</td>
```

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Build**

```bash
cd /home/sah/Synapse && pnpm --filter=web build
```

Expected: build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/admin/subscription-plans/
git commit -m "feat(admin): add subscription plan edit page and Modifier button"
```

---

## Self-Review

**Spec coverage:**
- ✅ Edit student info → Task 7
- ✅ Archive student (soft delete) → Task 3 + Task 6
- ✅ Restore archived student → Task 3 + Task 6
- ✅ Hard delete archived student → Task 3 + Task 6
- ✅ Edit employee → Task 9
- ✅ Archive/restore/hard-delete employee → Task 9 (same buttons)
- ✅ Edit subscription plan name/price/duration → Task 10
- ✅ Edit active student subscription (end_date, plan, cancel) → Task 4 + Task 8
- ✅ `is_archived` migration → Task 1
- ✅ Data layer filters archived → Task 2
- ✅ Employee list includes kiosk banner → Task 9 (preserved in replacement)

**Type consistency:**
- `archiveUserAction`, `restoreUserAction`, `hardDeleteUserAction` used in Tasks 5, 6, 9 — defined in Task 3 ✅
- `updateEmployeeAction` used in Task 9 — defined in Task 3 ✅
- `adminUpdateSubscriptionAction` used in Task 8 — defined in Task 4 ✅
- `listAllProfiles(role, showArchived)` used in Tasks 6, 9 — defined in Task 2 ✅
- `getProfileById` used in Tasks 7, 9 — defined in Task 2 ✅
- `getStudentWithSubscription` used in Task 8 — defined in Task 2 ✅
- `updatePlanAction` used in Task 10 — pre-existing ✅
