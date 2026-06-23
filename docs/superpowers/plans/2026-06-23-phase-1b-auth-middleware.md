# Phase 1B: Auth & Middleware

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire role-based routing so admin, employee, and student users each land in their own route group after login, and are blocked from accessing other groups.

**Architecture:** A single `src/middleware.ts` reads the Supabase session, fetches the user's role from `profiles`, and redirects to `/admin`, `/employee`, or `/student`. Three layout files enforce role guards server-side. `safe-action.ts` gains `adminActionClient` and `employeeActionClient` for server actions. The auth callback redirects by role instead of hardcoded `/dashboard`.

**Tech Stack:** Next.js 16 middleware, `@supabase/ssr`, `next-safe-action`, shadcn/ui sidebar

## Global Constraints

- Depends on Plan 1A (profiles table must exist)
- `/admin/*` — role = 'admin' only
- `/employee/*` — role IN ('admin', 'employee') — admin can access employee views
- `/student/*` — role = 'student' only
- `/login`, `/sign-up`, `/auth/*` — public; redirect to role dashboard if already logged in
- All commands run from `/home/sah/Synapse`
- French UI language

---

### Task 1: Create Next.js middleware

**Files:**
- Create: `apps/web/src/middleware.ts`
- Modify: `apps/web/src/supabase-clients/middleware.ts`

The existing `supabase-clients/middleware.ts` exports `updateSession` which handles cookie refresh. We extend it to also handle role-based redirects.

- [ ] **Step 1: Create `apps/web/src/middleware.ts`**

```typescript
// apps/web/src/middleware.ts
import { updateSession } from '@/supabase-clients/middleware'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Replace `apps/web/src/supabase-clients/middleware.ts` with role-aware version**

```typescript
// apps/web/src/supabase-clients/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type UserRole = 'admin' | 'employee' | 'student'

const ROLE_HOME: Record<UserRole, string> = {
  admin: '/admin/dashboard',
  employee: '/employee/dashboard',
  student: '/student/dashboard',
}

async function getUserRole(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<UserRole | null> {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return (data?.role as UserRole) ?? null
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: do not add logic between createServerClient and getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isPublicPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/update-password')

  // Redirect logged-in users away from auth pages
  if (isPublicPath && user) {
    const role = await getUserRole(supabase, user.id)
    if (role) {
      const url = request.nextUrl.clone()
      url.pathname = ROLE_HOME[role]
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Unauthenticated user on protected route
  if (!isPublicPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (!user) return supabaseResponse

  const role = await getUserRole(supabase, user.id)

  // Role-based access enforcement
  if (pathname.startsWith('/admin') && role !== 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = role ? ROLE_HOME[role] : '/login'
    return NextResponse.redirect(url)
  }

  if (
    pathname.startsWith('/employee') &&
    role !== 'admin' &&
    role !== 'employee'
  ) {
    const url = request.nextUrl.clone()
    url.pathname = role ? ROLE_HOME[role] : '/login'
    return NextResponse.redirect(url)
  }

  if (pathname.startsWith('/student') && role !== 'student') {
    const url = request.nextUrl.clone()
    url.pathname = role ? ROLE_HOME[role] : '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

- [ ] **Step 3: Verify middleware compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors in middleware.ts or supabase-clients/middleware.ts.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/middleware.ts apps/web/src/supabase-clients/middleware.ts
git commit -m "feat(auth): add role-based routing middleware"
```

---

### Task 2: Update auth callback + login redirect

**Files:**
- Modify: `apps/web/src/app/(auth-pages)/auth/callback/route.ts`
- Modify: `apps/web/src/app/(auth-pages)/login/Login.tsx`

- [ ] **Step 1: Update callback to redirect by role**

```typescript
// apps/web/src/app/(auth-pages)/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const ROLE_HOME: Record<string, string> = {
  admin: '/admin/dashboard',
  employee: '/employee/dashboard',
  student: '/student/dashboard',
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next')

  let redirectTo = new URL('/login', requestUrl.origin)

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    try {
      const { data: { user } } = await supabase.auth.exchangeCodeForSession(code)

      if (next) {
        redirectTo = new URL(decodeURIComponent(next), requestUrl.origin)
      } else if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const home = profile?.role ? ROLE_HOME[profile.role] : '/login'
        redirectTo = new URL(home, requestUrl.origin)
      }
    } catch (error) {
      console.error('Failed to exchange code for session:', error)
      redirectTo = new URL('/auth/auth-code-error', requestUrl.origin)
    }
  }

  revalidatePath('/', 'layout')
  return NextResponse.redirect(redirectTo)
}
```

- [ ] **Step 2: Update Login.tsx redirect — replace hardcoded `/dashboard`**

In `apps/web/src/app/(auth-pages)/login/Login.tsx`, find `redirectToDashboard`:

```typescript
// Replace the existing redirectToDashboard function:
function redirectToDashboard() {
  if (next) {
    router.push(`/auth/callback?next=${next}`)
  } else {
    // Middleware will redirect to correct role home after session is set
    router.push('/auth/callback')
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(auth-pages)/auth/callback/route.ts \
        apps/web/src/app/(auth-pages)/login/Login.tsx
git commit -m "feat(auth): redirect to role-appropriate dashboard after login"
```

---

### Task 3: Role-scoped action clients

**Files:**
- Modify: `apps/web/src/lib/safe-action.ts`
- Modify: `apps/web/src/data/user/user.ts`

- [ ] **Step 1: Add `getLoggedInUserProfile` to `apps/web/src/data/user/user.ts`**

```typescript
// apps/web/src/data/user/user.ts
'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export async function getLoggedInUserId(): Promise<string> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims?.sub) {
    throw new Error('User not logged in')
  }
  return data.claims.sub
}

export async function getLoggedInUserProfile() {
  const supabase = await createSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('User not logged in')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) throw new Error('Profile not found')
  return profile
}
```

- [ ] **Step 2: Add role-scoped clients to `apps/web/src/lib/safe-action.ts`**

```typescript
// apps/web/src/lib/safe-action.ts
import { getLoggedInUserId, getLoggedInUserProfile } from '@/data/user/user'
import { createSafeActionClient } from 'next-safe-action'
import 'server-only'

export const actionClient = createSafeActionClient().use(
  async ({ next, clientInput, metadata }) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('LOGGING MIDDLEWARE')
      const startTime = performance.now()
      const result = await next()
      const endTime = performance.now()
      console.log('Result ->', result)
      console.log('Client input ->', clientInput)
      console.log('Metadata ->', metadata)
      console.log('Action execution took', endTime - startTime, 'ms')
      return result
    }
    return await next()
  }
)

export const authActionClient = actionClient.use(async ({ next }) => {
  const userId = await getLoggedInUserId()
  return await next({ ctx: { userId } })
})

export const adminActionClient = actionClient.use(async ({ next }) => {
  const profile = await getLoggedInUserProfile()
  if (profile.role !== 'admin') {
    throw new Error('Accès refusé: droits administrateur requis')
  }
  return await next({ ctx: { userId: profile.id, role: profile.role } })
})

export const employeeActionClient = actionClient.use(async ({ next }) => {
  const profile = await getLoggedInUserProfile()
  if (profile.role !== 'admin' && profile.role !== 'employee') {
    throw new Error('Accès refusé: droits employé requis')
  }
  return await next({ ctx: { userId: profile.id, role: profile.role } })
})

export const studentActionClient = actionClient.use(async ({ next }) => {
  const profile = await getLoggedInUserProfile()
  if (profile.role !== 'student') {
    throw new Error('Accès refusé')
  }
  return await next({ ctx: { userId: profile.id, role: profile.role } })
})
```

- [ ] **Step 3: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/safe-action.ts apps/web/src/data/user/user.ts
git commit -m "feat(auth): add adminActionClient, employeeActionClient, studentActionClient"
```

---

### Task 4: Remove boilerplate routes, create route structure

**Files:**
- Delete: `apps/web/src/app/(app-pages)/` (entire directory)
- Delete: `apps/web/src/app/(external-pages)/` (entire directory)
- Delete: `apps/web/src/app/Navbar.tsx`, `apps/web/src/app/NavLink.tsx`, `apps/web/src/app/LoginNavLink.tsx`, `apps/web/src/app/MobileNavigation.tsx`, `apps/web/src/app/Banner.tsx`
- Create: `apps/web/src/app/admin/` structure
- Create: `apps/web/src/app/employee/` structure
- Create: `apps/web/src/app/student/` structure
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/ClientLayout.tsx`

- [ ] **Step 1: Delete boilerplate directories and files**

```bash
rm -rf apps/web/src/app/\(app-pages\)
rm -rf apps/web/src/app/\(external-pages\)
rm -f apps/web/src/app/Navbar.tsx
rm -f apps/web/src/app/NavLink.tsx
rm -f apps/web/src/app/LoginNavLink.tsx
rm -f apps/web/src/app/MobileNavigation.tsx
rm -f apps/web/src/app/Banner.tsx
rm -f apps/web/src/data/anon/privateItems.ts
rm -f apps/web/src/data/user/privateItems.ts
rm -f apps/web/src/utils/zod-schemas/blog.ts
```

- [ ] **Step 2: Update `apps/web/src/app/layout.tsx` — clean root layout**

```typescript
// apps/web/src/app/layout.tsx
import '@/styles/globals.css'
import localFont from 'next/font/local'
import { DynamicLayoutProviders } from './DynamicLayoutProviders'

const inter = localFont({
  src: [
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata = {
  title: 'Synapse Management Platform',
  description: 'Gestion de l\'espace de coworking Synapse',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={inter.variable}>
      <head />
      <body>
        <DynamicLayoutProviders>
          {children}
        </DynamicLayoutProviders>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Update `apps/web/src/app/ClientLayout.tsx` — remove boilerplate nav**

```typescript
// apps/web/src/app/ClientLayout.tsx
'use client'

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

- [ ] **Step 4: Create placeholder route for root `/`**

```typescript
// apps/web/src/app/page.tsx
import { redirect } from 'next/navigation'

// Root redirects to login; middleware handles role-based redirect if logged in
export default function RootPage() {
  redirect('/login')
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove NextBase boilerplate routes, scaffold SMP route structure"
```

---

### Task 5: Admin layout

**Files:**
- Create: `apps/web/src/app/admin/layout.tsx`
- Create: `apps/web/src/app/admin/dashboard/page.tsx`

- [ ] **Step 1: Create `apps/web/src/app/admin/layout.tsx`**

```typescript
// apps/web/src/app/admin/layout.tsx
import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { signOutAction } from '@/data/auth/sign-out'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/login')

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-sidebar flex flex-col">
        <div className="p-4 border-b">
          <h1 className="font-semibold text-sm">Synapse</h1>
          <p className="text-xs text-muted-foreground">Administration</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 text-sm">
          <Link href="/admin/dashboard" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent">
            Tableau de bord
          </Link>
          <Link href="/admin/students" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent">
            Étudiants
          </Link>
          <Link href="/admin/employees" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent">
            Employés
          </Link>
          <Link href="/admin/subscription-plans" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent">
            Formules
          </Link>
        </nav>
        <div className="p-4 border-t text-xs text-muted-foreground">
          <p>{profile.full_name}</p>
          <form action={signOutAction}>
            <button type="submit" className="text-destructive mt-1">Déconnexion</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Create `apps/web/src/app/admin/dashboard/page.tsx`**

```typescript
// apps/web/src/app/admin/dashboard/page.tsx
export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Tableau de bord</h1>
      <p className="text-muted-foreground mt-1">
        Statistiques et indicateurs — Phase 7
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/admin/
git commit -m "feat(admin): add admin layout with sidebar navigation"
```

---

### Task 6: Employee layout

**Files:**
- Create: `apps/web/src/app/employee/layout.tsx`
- Create: `apps/web/src/app/employee/dashboard/page.tsx`

- [ ] **Step 1: Create `apps/web/src/app/employee/layout.tsx`**

```typescript
// apps/web/src/app/employee/layout.tsx
import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { signOutAction } from '@/data/auth/sign-out'

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'employee'].includes(profile.role)) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-sidebar flex flex-col">
        <div className="p-4 border-b">
          <h1 className="font-semibold text-sm">Synapse</h1>
          <p className="text-xs text-muted-foreground">Accueil</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 text-sm">
          <Link href="/employee/dashboard" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent">
            Tableau de bord
          </Link>
          <Link href="/employee/students" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent">
            Étudiants
          </Link>
          <Link href="/employee/pos" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent">
            Caisse
          </Link>
          <Link href="/employee/checkin" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent">
            Contrôle accès
          </Link>
        </nav>
        <div className="p-4 border-t text-xs text-muted-foreground">
          <p>{profile.full_name}</p>
          <form action={signOutAction}>
            <button type="submit" className="text-destructive mt-1">Déconnexion</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Create placeholder dashboard**

```typescript
// apps/web/src/app/employee/dashboard/page.tsx
export default function EmployeeDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Tableau de bord</h1>
      <p className="text-muted-foreground mt-1">Résumé de la journée</p>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/employee/
git commit -m "feat(employee): add employee layout with sidebar navigation"
```

---

### Task 7: Student layout (PWA-ready)

**Files:**
- Create: `apps/web/src/app/student/layout.tsx`
- Create: `apps/web/src/app/student/dashboard/page.tsx`
- Modify: `apps/web/next.config.ts` — add PWA manifest reference

- [ ] **Step 1: Create `apps/web/src/app/student/layout.tsx`**

```typescript
// apps/web/src/app/student/layout.tsx
import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { signOutAction } from '@/data/auth/sign-out'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'student') redirect('/login')

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-sm">Synapse</span>
        <span className="text-xs text-muted-foreground">{profile.full_name}</span>
      </header>
      <main className="flex-1 p-4 pb-20">{children}</main>
      {/* Bottom nav — mobile-first */}
      <nav className="fixed bottom-0 inset-x-0 border-t bg-background flex">
        <Link href="/student/dashboard" className="flex-1 flex flex-col items-center py-3 text-xs gap-1">
          Abonnement
        </Link>
        <Link href="/student/qr" className="flex-1 flex flex-col items-center py-3 text-xs gap-1">
          QR Code
        </Link>
        <Link href="/student/reservation" className="flex-1 flex flex-col items-center py-3 text-xs gap-1">
          Réserver
        </Link>
        <Link href="/student/loyalty" className="flex-1 flex flex-col items-center py-3 text-xs gap-1">
          Points
        </Link>
      </nav>
    </div>
  )
}
```

- [ ] **Step 2: Create placeholder student dashboard**

```typescript
// apps/web/src/app/student/dashboard/page.tsx
export default function StudentDashboardPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold">Mon abonnement</h1>
      <p className="text-muted-foreground mt-1 text-sm">Chargement...</p>
    </div>
  )
}
```

- [ ] **Step 3: Add PWA manifest to `apps/web/public/manifest.json`**

```json
{
  "name": "Synapse",
  "short_name": "Synapse",
  "description": "Espace Synapse — votre abonnement et réservations",
  "start_url": "/student/dashboard",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/logos/logo.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 4: Reference manifest in root layout**

In `apps/web/src/app/layout.tsx`, update `metadata`:

```typescript
export const metadata = {
  title: 'Synapse Management Platform',
  description: "Gestion de l'espace de coworking Synapse",
  manifest: '/manifest.json',
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/student/ apps/web/public/manifest.json apps/web/src/app/layout.tsx
git commit -m "feat(student): add student PWA layout with bottom navigation"
```

---

### Task 8: Update sign-out action

**Files:**
- Modify: `apps/web/src/data/auth/sign-out.ts`

The existing sign-out redirects to `/`. Update to `/login`.

- [ ] **Step 1: Read current sign-out**

```bash
cat apps/web/src/data/auth/sign-out.ts
```

- [ ] **Step 2: Update redirect target**

```typescript
// apps/web/src/data/auth/sign-out.ts
'use server'

import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'

export async function signOutAction() {
  const supabase = await createSupabaseClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

- [ ] **Step 3: Typecheck + test manually**

```bash
cd apps/web && npx tsc --noEmit
pnpm dev
```

Open http://localhost:3000 → should redirect to `/login`. Log in as admin (seed user) → should land at `/admin/dashboard`. Log in as employee → `/employee/dashboard`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/data/auth/sign-out.ts
git commit -m "fix(auth): sign-out redirects to /login"
```
