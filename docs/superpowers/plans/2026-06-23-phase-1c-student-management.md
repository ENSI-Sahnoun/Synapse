# Phase 1C: Student Management

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Employee and admin can create, list, search, and view student profiles. Admin can also manage employees.

**Architecture:** Zod schemas validate form input. Data functions in `src/data/` query Supabase directly (RSC). Server actions in `src/actions/` use `employeeActionClient` / `adminActionClient` for mutations. Shared `StudentForm` component used by both employee and admin routes. Employee uses service-role Supabase client (via `createSupabaseAdminClient`) to create auth users on behalf of students.

**Tech Stack:** next-safe-action, Zod, shadcn/ui (Form, Input, Select, Table), Supabase admin client

## Global Constraints

- Depends on Plan 1A (profiles table) and Plan 1B (action clients, route layouts)
- Students cannot be created without a Supabase auth user — always call `supabase.auth.admin.createUser()` first
- Employee creates students only; admin creates students and employees
- `profiles.role` always set via server action after trigger creates the row — trigger always defaults to `'student'`
- All commands run from `/home/sah/Synapse`
- French UI

---

### Task 1: Zod schemas + Supabase admin client

**Files:**
- Create: `apps/web/src/utils/zod-schemas/student.ts`
- Create: `apps/web/src/supabase-clients/admin.ts`

- [ ] **Step 1: Create student Zod schema**

```typescript
// apps/web/src/utils/zod-schemas/student.ts
import { z } from 'zod'

export const createStudentSchema = z.object({
  full_name: z.string().min(2, 'Nom requis (min 2 caractères)'),
  phone: z.string().min(8, 'Téléphone requis').optional().or(z.literal('')),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  university: z.string().optional().or(z.literal('')),
  study_level: z.string().optional().or(z.literal('')),
})

export type CreateStudentInput = z.infer<typeof createStudentSchema>

export const updateStudentSchema = createStudentSchema.partial().extend({
  id: z.string().uuid(),
})

export type UpdateStudentInput = z.infer<typeof updateStudentSchema>
```

- [ ] **Step 2: Create Supabase admin client**

The admin client uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS. Only used server-side.

```typescript
// apps/web/src/supabase-clients/admin.ts
import { createClient } from '@supabase/supabase-js'
import 'server-only'
import type { Database } from '@/lib/database.types'

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  }

  return createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
```

- [ ] **Step 3: Add `SUPABASE_SERVICE_ROLE_KEY` to env example**

In `apps/web/.env.local.example` (or `.env.local.example` at root), add:
```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

- [ ] **Step 4: Write test for schema validation**

```typescript
// apps/web/src/utils/zod-schemas/student.test.ts
import { describe, it, expect } from 'vitest'
import { createStudentSchema } from './student'

describe('createStudentSchema', () => {
  it('passes with valid data', () => {
    const result = createStudentSchema.safeParse({
      full_name: 'Ahmed Ben Ali',
      phone: '22334455',
      email: 'ahmed@example.com',
      university: 'ISIMS',
      study_level: 'Licence 3',
    })
    expect(result.success).toBe(true)
  })

  it('fails when full_name is too short', () => {
    const result = createStudentSchema.safeParse({ full_name: 'A' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Nom requis (min 2 caractères)')
  })

  it('allows empty optional fields', () => {
    const result = createStudentSchema.safeParse({ full_name: 'Ali Trabelsi' })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 5: Run test**

```bash
cd apps/web && pnpm test -- --reporter=verbose student.test
```

Expected: 3 passing tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/utils/zod-schemas/student.ts \
        apps/web/src/utils/zod-schemas/student.test.ts \
        apps/web/src/supabase-clients/admin.ts
git commit -m "feat(students): add student schema and supabase admin client"
```

---

### Task 2: Data layer — student queries

**Files:**
- Create: `apps/web/src/data/employee/students.ts`
- Create: `apps/web/src/data/admin/students.ts`

- [ ] **Step 1: Create employee student queries**

```typescript
// apps/web/src/data/employee/students.ts
'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export async function listStudents(search?: string) {
  const supabase = await createSupabaseClient()
  let query = supabase
    .from('profiles')
    .select('id, full_name, phone, university, study_level, created_at')
    .eq('role', 'student')
    .order('created_at', { ascending: false })

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getStudentById(id: string) {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, full_name, phone, university, study_level, qr_token, created_at,
      subscriptions (
        id, start_date, end_date, paid_amount, created_at,
        subscription_plans ( name, duration_days, price_dt )
      )
    `)
    .eq('id', id)
    .eq('role', 'student')
    .order('created_at', { ascending: false, foreignTable: 'subscriptions' })
    .single()

  if (error) throw error
  return data
}

export async function getActiveSubscription(studentId: string) {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('id, start_date, end_date, subscription_plans(name)')
    .eq('student_id', studentId)
    .gte('end_date', new Date().toISOString().split('T')[0])
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}
```

- [ ] **Step 2: Create admin student queries (extends employee, adds employee listing)**

```typescript
// apps/web/src/data/admin/students.ts
'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export async function listAllProfiles(role?: 'student' | 'employee' | 'admin') {
  const supabase = await createSupabaseClient()
  let query = supabase
    .from('profiles')
    .select('id, full_name, phone, role, university, study_level, created_at')
    .order('created_at', { ascending: false })

  if (role) query = query.eq('role', role)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/data/employee/students.ts \
        apps/web/src/data/admin/students.ts
git commit -m "feat(students): add student data query functions"
```

---

### Task 3: Server actions — create student

**Files:**
- Create: `apps/web/src/actions/employee/students.ts`
- Create: `apps/web/src/actions/employee/students.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/src/actions/employee/students.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the admin client
vi.mock('@/supabase-clients/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}))

vi.mock('@/lib/safe-action', () => ({
  employeeActionClient: {
    use: vi.fn().mockReturnThis(),
    schema: vi.fn().mockReturnThis(),
    action: vi.fn(),
  },
}))

describe('createStudentAction', () => {
  it('should be defined', async () => {
    const { createStudentAction } = await import('./students')
    expect(createStudentAction).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && pnpm test -- --reporter=verbose students.test 2>&1 | tail -20
```

Expected: FAIL — module not found or action not defined.

- [ ] **Step 3: Create action**

```typescript
// apps/web/src/actions/employee/students.ts
'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { createStudentSchema } from '@/utils/zod-schemas/student'
import { revalidatePath } from 'next/cache'

export const createStudentAction = employeeActionClient
  .schema(createStudentSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { full_name, phone, email, university, study_level } = parsedInput
    const adminSupabase = createSupabaseAdminClient()

    // Generate a temporary password — student will reset via email
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'

    // Create auth user (triggers handle_new_user → creates profile with role='student')
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: email || `${phone}@synapse.local`,
      password: tempPassword,
      user_metadata: { full_name, phone, university, study_level },
      email_confirm: true, // skip email confirmation for admin-created accounts
    })

    if (authError) throw new Error(`Erreur création compte: ${authError.message}`)

    const userId = authData.user.id

    // Update profile with complete details (trigger may have set partial data)
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .update({ full_name, phone, university, study_level })
      .eq('id', userId)

    if (profileError) throw new Error(`Erreur profil: ${profileError.message}`)

    revalidatePath('/employee/students')
    revalidatePath('/admin/students')

    return { studentId: userId }
  })
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && pnpm test -- --reporter=verbose students.test
```

Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/actions/employee/students.ts \
        apps/web/src/actions/employee/students.test.ts
git commit -m "feat(students): add createStudentAction with auth user creation"
```

---

### Task 4: Student form component

**Files:**
- Create: `apps/web/src/components/students/student-form.tsx`

- [ ] **Step 1: Create form component**

```typescript
// apps/web/src/components/students/student-form.tsx
'use client'

import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createStudentAction } from '@/actions/employee/students'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createStudentSchema, type CreateStudentInput } from '@/utils/zod-schemas/student'

interface StudentFormProps {
  redirectTo: string
}

export function StudentForm({ redirectTo }: StudentFormProps) {
  const router = useRouter()
  const form = useForm<CreateStudentInput>({
    resolver: zodResolver(createStudentSchema),
    defaultValues: { full_name: '', phone: '', email: '', university: '', study_level: '' },
  })

  const { execute, status } = useAction(createStudentAction, {
    onSuccess: () => {
      toast.success('Étudiant créé avec succès')
      router.push(redirectTo)
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur lors de la création')
    },
  })

  return (
    <form onSubmit={form.handleSubmit((data) => execute(data))} className="space-y-4 max-w-md">
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
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...form.register('email')} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="university">Université</Label>
        <Input id="university" {...form.register('university')} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="study_level">Niveau d'étude</Label>
        <Input id="study_level" {...form.register('study_level')} placeholder="ex: Licence 3, Master 1" />
      </div>

      <Button type="submit" disabled={status === 'executing'}>
        {status === 'executing' ? 'Création...' : 'Créer l\'étudiant'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/students/student-form.tsx
git commit -m "feat(students): add StudentForm component"
```

---

### Task 5: Employee student pages

**Files:**
- Create: `apps/web/src/app/employee/students/page.tsx`
- Create: `apps/web/src/app/employee/students/new/page.tsx`
- Create: `apps/web/src/app/employee/students/[studentId]/page.tsx`

- [ ] **Step 1: Create student list page**

```typescript
// apps/web/src/app/employee/students/page.tsx
import { listStudents } from '@/data/employee/students'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function EmployeeStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const students = await listStudents(q)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Étudiants</h1>
        <Button asChild>
          <Link href="/employee/students/new">Nouvel étudiant</Link>
        </Button>
      </div>

      <form method="GET" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Rechercher par nom ou téléphone..."
          className="border rounded-md px-3 py-2 text-sm w-72"
        />
        <Button type="submit" variant="outline">Rechercher</Button>
      </form>

      <div className="border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2">Nom</th>
              <th className="text-left px-4 py-2">Téléphone</th>
              <th className="text-left px-4 py-2">Université</th>
              <th className="text-left px-4 py-2">Inscription</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted-foreground">
                  Aucun étudiant trouvé
                </td>
              </tr>
            )}
            {students.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{s.full_name}</td>
                <td className="px-4 py-2 text-muted-foreground">{s.phone ?? '—'}</td>
                <td className="px-4 py-2 text-muted-foreground">{s.university ?? '—'}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-2">
                  <Link href={`/employee/students/${s.id}`} className="text-primary hover:underline text-xs">
                    Voir
                  </Link>
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

- [ ] **Step 2: Create new student page**

```typescript
// apps/web/src/app/employee/students/new/page.tsx
import { StudentForm } from '@/components/students/student-form'
import Link from 'next/link'

export default function NewStudentPage() {
  return (
    <div className="space-y-4">
      <div>
        <Link href="/employee/students" className="text-sm text-muted-foreground hover:underline">
          ← Étudiants
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Nouvel étudiant</h1>
      </div>
      <StudentForm redirectTo="/employee/students" />
    </div>
  )
}
```

- [ ] **Step 3: Create student detail page**

```typescript
// apps/web/src/app/employee/students/[studentId]/page.tsx
import { getStudentById } from '@/data/employee/students'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params

  let student
  try {
    student = await getStudentById(studentId)
  } catch {
    notFound()
  }

  if (!student) notFound()

  const today = new Date().toISOString().split('T')[0]
  const activeSubscription = student.subscriptions?.find((s) => s.end_date >= today)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/employee/students" className="text-sm text-muted-foreground hover:underline">
          ← Étudiants
        </Link>
        <h1 className="text-2xl font-semibold mt-1">{student.full_name}</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-muted-foreground">Téléphone:</span> {student.phone ?? '—'}</div>
        <div><span className="text-muted-foreground">Université:</span> {student.university ?? '—'}</div>
        <div><span className="text-muted-foreground">Niveau:</span> {student.study_level ?? '—'}</div>
        <div><span className="text-muted-foreground">Inscrit le:</span> {new Date(student.created_at).toLocaleDateString('fr-FR')}</div>
      </div>

      <div className="border rounded-md p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Abonnement actif</h2>
          <Button asChild size="sm">
            <Link href={`/employee/students/${studentId}/subscriptions/new`}>
              Vendre abonnement
            </Link>
          </Button>
        </div>
        {activeSubscription ? (
          <div className="text-sm space-y-1">
            <p className="font-medium">{(activeSubscription.subscription_plans as { name: string })?.name}</p>
            <p className="text-muted-foreground">
              Valide jusqu'au {new Date(activeSubscription.end_date).toLocaleDateString('fr-FR')}
            </p>
          </div>
        ) : (
          <p className="text-sm text-destructive">Aucun abonnement actif</p>
        )}
      </div>

      {student.subscriptions && student.subscriptions.length > 0 && (
        <div>
          <h2 className="font-medium mb-2">Historique</h2>
          <div className="border rounded-md divide-y text-sm">
            {student.subscriptions.map((s) => (
              <div key={s.id} className="px-4 py-2 flex justify-between">
                <span>{(s.subscription_plans as { name: string })?.name}</span>
                <span className="text-muted-foreground">
                  {new Date(s.start_date).toLocaleDateString('fr-FR')} → {new Date(s.end_date).toLocaleDateString('fr-FR')}
                </span>
                <span>{s.paid_amount} DT</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
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
git add apps/web/src/app/employee/students/
git commit -m "feat(students): add employee student list, new, and detail pages"
```

---

### Task 6: Admin student + employee pages

**Files:**
- Create: `apps/web/src/app/admin/students/page.tsx`
- Create: `apps/web/src/app/admin/students/new/page.tsx`
- Create: `apps/web/src/app/admin/employees/page.tsx`
- Create: `apps/web/src/app/admin/employees/new/page.tsx`
- Create: `apps/web/src/actions/admin/employees.ts`

- [ ] **Step 1: Admin students list (reuses same data, same UI pattern)**

```typescript
// apps/web/src/app/admin/students/page.tsx
import { listAllProfiles } from '@/data/admin/students'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function AdminStudentsPage() {
  const students = await listAllProfiles('student')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Étudiants</h1>
        <Button asChild>
          <Link href="/admin/students/new">Nouvel étudiant</Link>
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">{students.length} étudiant(s)</p>
      <div className="border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2">Nom</th>
              <th className="text-left px-4 py-2">Téléphone</th>
              <th className="text-left px-4 py-2">Université</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-2">{s.full_name}</td>
                <td className="px-4 py-2 text-muted-foreground">{s.phone ?? '—'}</td>
                <td className="px-4 py-2 text-muted-foreground">{s.university ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Admin new student page**

```typescript
// apps/web/src/app/admin/students/new/page.tsx
import { StudentForm } from '@/components/students/student-form'
import Link from 'next/link'

export default function AdminNewStudentPage() {
  return (
    <div className="space-y-4">
      <Link href="/admin/students" className="text-sm text-muted-foreground hover:underline">← Étudiants</Link>
      <h1 className="text-2xl font-semibold">Nouvel étudiant</h1>
      <StudentForm redirectTo="/admin/students" />
    </div>
  )
}
```

- [ ] **Step 3: Create employee action (admin only)**

```typescript
// apps/web/src/actions/admin/employees.ts
'use server'

import { adminActionClient } from '@/lib/safe-action'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const createEmployeeSchema = z.object({
  full_name: z.string().min(2, 'Nom requis'),
  email: z.string().email('Email invalide'),
  phone: z.string().optional(),
})

export const createEmployeeAction = adminActionClient
  .schema(createEmployeeSchema)
  .action(async ({ parsedInput }) => {
    const { full_name, email, phone } = parsedInput
    const adminSupabase = createSupabaseAdminClient()

    const tempPassword = Math.random().toString(36).slice(-12) + 'E1!'

    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password: tempPassword,
      user_metadata: { full_name, phone },
      email_confirm: true,
    })

    if (authError) throw new Error(`Erreur: ${authError.message}`)

    // Elevate role from 'student' (trigger default) to 'employee'
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .update({ role: 'employee', full_name, phone })
      .eq('id', authData.user.id)

    if (profileError) throw new Error(`Erreur profil: ${profileError.message}`)

    revalidatePath('/admin/employees')
    return { employeeId: authData.user.id }
  })
```

- [ ] **Step 4: Employee list + new pages**

```typescript
// apps/web/src/app/admin/employees/page.tsx
import { listAllProfiles } from '@/data/admin/students'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function AdminEmployeesPage() {
  const employees = await listAllProfiles('employee')
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Employés</h1>
        <Button asChild><Link href="/admin/employees/new">Nouvel employé</Link></Button>
      </div>
      <div className="border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2">Nom</th>
              <th className="text-left px-4 py-2">Téléphone</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr><td colSpan={2} className="text-center py-8 text-muted-foreground">Aucun employé</td></tr>
            )}
            {employees.map((e) => (
              <tr key={e.id} className="border-b last:border-0">
                <td className="px-4 py-2">{e.full_name}</td>
                <td className="px-4 py-2 text-muted-foreground">{e.phone ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

```typescript
// apps/web/src/app/admin/employees/new/page.tsx
'use client'

import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createEmployeeAction } from '@/actions/admin/employees'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import Link from 'next/link'

export default function NewEmployeePage() {
  const router = useRouter()
  const form = useForm({ defaultValues: { full_name: '', email: '', phone: '' } })

  const { execute, status } = useAction(createEmployeeAction, {
    onSuccess: () => { toast.success('Employé créé'); router.push('/admin/employees') },
    onError: ({ error }) => { toast.error(error.serverError ?? 'Erreur') },
  })

  return (
    <div className="space-y-4">
      <Link href="/admin/employees" className="text-sm text-muted-foreground hover:underline">← Employés</Link>
      <h1 className="text-2xl font-semibold">Nouvel employé</h1>
      <form onSubmit={form.handleSubmit((d) => execute(d))} className="space-y-4 max-w-md">
        <div className="space-y-1">
          <Label>Nom complet *</Label>
          <Input {...form.register('full_name')} />
        </div>
        <div className="space-y-1">
          <Label>Email *</Label>
          <Input type="email" {...form.register('email')} />
        </div>
        <div className="space-y-1">
          <Label>Téléphone</Label>
          <Input {...form.register('phone')} />
        </div>
        <Button type="submit" disabled={status === 'executing'}>
          {status === 'executing' ? 'Création...' : 'Créer l\'employé'}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: Typecheck + commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/src/app/admin/students/ \
        apps/web/src/app/admin/employees/ \
        apps/web/src/actions/admin/employees.ts
git commit -m "feat(admin): add admin student and employee management pages"
```
