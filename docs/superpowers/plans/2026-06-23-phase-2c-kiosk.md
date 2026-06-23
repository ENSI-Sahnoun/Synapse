# Phase 2C: Kiosk Mode

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fullscreen, navigation-free self-serve check-in terminal at `/kiosk` that runs under a pinned employee-role session and continuously scans student QR codes, displaying results in an auto-looping display.

**Architecture:** The `/kiosk` route group lives outside all nav layouts — it has its own `layout.tsx` with no sidebar, no header, just a black fullscreen canvas. A dedicated "kiosk employee" Supabase user (created by admin) is signed in on the device; the session is persisted in the browser and never times out. The kiosk page re-uses `QrScanner` and a kiosk-specific `KioskResult` component that is larger, higher-contrast, and auto-loops faster (2.5s vs 4s). On the kiosk device the employee/admin opens `/kiosk/setup` once to sign in; after that `/kiosk` is the permanent URL. The kiosk does not expose any navigation that could break out to the admin or employee views.

**Tech Stack:** Next.js 16 (own route group), `@zxing/library` (reused from Phase 2B), `next-safe-action`, Supabase cookie-based session

## Global Constraints

- Depends on Phase 2A (`verifyQrToken`) and Phase 2B (`checkinAction`, `checkoutAction`, `attendance` table)
- `/kiosk` requires a logged-in user with role `employee` or `admin` — middleware already enforces this via the `ROLE_HOME` redirect logic; kiosk needs a custom middleware exception
- No navigation outside `/kiosk/*` is reachable from the kiosk UI
- The kiosk session is a normal Supabase session — no special auth mechanism
- `entry_method = 'qr_scan'` for all kiosk check-ins (same as employee device)
- French UI — large text for readability at a distance
- Kiosk route is excluded from the employee layout — it must NOT inherit `apps/web/src/app/employee/layout.tsx`
- All commands from `/home/sah/Synapse`

---

### Task 1: Update middleware to allow kiosk route for employee/admin sessions

**Files:**
- Modify: `apps/web/src/supabase-clients/middleware.ts`

The current middleware (Phase 1B) redirects all employee sessions to `/employee/dashboard`. We need `/kiosk/*` to be accessible to employees and admins without redirect.

- [ ] **Step 1: Add kiosk exception**

In `apps/web/src/supabase-clients/middleware.ts`, inside the `updateSession` function, find the role-based guard block and add a kiosk bypass before the `/employee` guard:

```typescript
// In apps/web/src/supabase-clients/middleware.ts
// Add this block BEFORE the existing role guard checks:

// Kiosk: accessible to employees and admins — skip standard role redirect
if (pathname.startsWith('/kiosk')) {
  if (role === 'admin' || role === 'employee') {
    return supabaseResponse
  }
  // Students and unauthenticated users are blocked
  const url = request.nextUrl.clone()
  url.pathname = role === 'student' ? ROLE_HOME['student'] : '/login'
  return NextResponse.redirect(url)
}
```

The full updated guard section (replace from `// Role-based access enforcement` to end of function):

```typescript
  // Role-based access enforcement

  // Kiosk: accessible to employees and admins — no redirect to role home
  if (pathname.startsWith('/kiosk')) {
    if (role === 'admin' || role === 'employee') {
      return supabaseResponse
    }
    const url = request.nextUrl.clone()
    url.pathname = role === 'student' ? ROLE_HOME['student'] : '/login'
    return NextResponse.redirect(url)
  }

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
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/supabase-clients/middleware.ts
git commit -m "feat(kiosk): allow employee/admin sessions on /kiosk/* without redirect"
```

---

### Task 2: Kiosk route layout

**Files:**
- Create: `apps/web/src/app/kiosk/layout.tsx`

The kiosk layout is a black fullscreen shell with no navigation. It verifies the session server-side and redirects to `/kiosk/setup` if not authenticated as employee/admin.

- [ ] **Step 1: Create the layout**

```typescript
// apps/web/src/app/kiosk/layout.tsx
import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Synapse — Kiosque',
}

export default async function KioskLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/kiosk/setup')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'employee'].includes(profile.role)) {
    redirect('/kiosk/setup')
  }

  return (
    <html lang="fr">
      <body className="bg-black text-white overflow-hidden w-screen h-screen">
        {children}
      </body>
    </html>
  )
}
```

Note: `kiosk/layout.tsx` returns its own `<html>` and `<body>` because the kiosk is a completely isolated experience — it must not inherit the root layout's font, theme provider, or anything else. This is valid in Next.js 16 for route groups not nested under the root layout segment. If the project structure nests `/kiosk` under the root layout (common in App Router), use a template instead:

```typescript
// apps/web/src/app/kiosk/layout.tsx (alternate — no html/body tags if root layout applies)
import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Synapse — Kiosque',
}

export default async function KioskLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/kiosk/setup')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'employee'].includes(profile.role)) {
    redirect('/kiosk/setup')
  }

  return (
    <div className="bg-black text-white w-screen h-screen overflow-hidden fixed inset-0">
      {children}
    </div>
  )
}
```

Use the second (no `<html>`) version since the app uses a root layout. The black background and `overflow-hidden` provide the fullscreen effect.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/kiosk/layout.tsx
git commit -m "feat(kiosk): add fullscreen kiosk layout with auth guard"
```

---

### Task 3: Kiosk setup page (one-time login)

**Files:**
- Create: `apps/web/src/app/kiosk/setup/page.tsx`
- Create: `apps/web/src/app/kiosk/setup/KioskLoginForm.tsx`

This page allows an employee to sign in on the kiosk device. After login the device stays on `/kiosk` permanently.

- [ ] **Step 1: Create login form Client Component**

```typescript
// apps/web/src/app/kiosk/setup/KioskLoginForm.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

// Uses the browser client directly for kiosk login
// The session is persisted in browser storage

export function KioskLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Import the browser Supabase client
      const { createBrowserClient } = await import('@supabase/ssr')
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      )

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError('Email ou mot de passe incorrect.')
        return
      }

      if (!data.user) {
        setError('Connexion échouée.')
        return
      }

      // Verify role server-side before redirecting
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (!profile || !['admin', 'employee'].includes(profile.role)) {
        await supabase.auth.signOut()
        setError('Ce compte n\'a pas accès au kiosque.')
        return
      }

      router.push('/kiosk')
      router.refresh()
    } catch (e) {
      setError('Erreur inattendue. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-xs">
      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-xs text-gray-400">
          Email employé
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
          className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-white"
          placeholder="employe@synapse.tn"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-xs text-gray-400">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-white"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-white text-black rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50"
      >
        {loading ? 'Connexion…' : 'Activer le kiosque'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Create setup page**

```typescript
// apps/web/src/app/kiosk/setup/page.tsx
import { KioskLoginForm } from './KioskLoginForm'

export const metadata = {
  title: 'Configuration du kiosque — Synapse',
}

export default function KioskSetupPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 bg-black text-white px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Synapse</h1>
        <p className="text-gray-400 text-sm mt-2">
          Configuration du kiosque d&apos;accès
        </p>
      </div>

      <KioskLoginForm />

      <p className="text-xs text-gray-600 text-center max-w-xs">
        Connectez-vous avec un compte employé. Cette page ne s&apos;affiche qu&apos;une
        seule fois par appareil.
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/kiosk/setup/
git commit -m "feat(kiosk): add one-time setup login page for kiosk device"
```

---

### Task 4: Kiosk result display component

**Files:**
- Create: `apps/web/src/components/kiosk/KioskResult.tsx`

Larger, higher-contrast version of `CheckinResult` for display at a distance. Auto-resets in 2.5 seconds.

- [ ] **Step 1: Create the component**

```typescript
// apps/web/src/components/kiosk/KioskResult.tsx
'use client'

import { useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { CheckinResult } from '@/utils/zod-schemas/checkin'

interface KioskResultProps {
  result: CheckinResult
  onReset: () => void
}

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd MMMM yyyy', { locale: fr })
  } catch {
    return dateStr
  }
}

export function KioskResult({ result, onReset }: KioskResultProps) {
  useEffect(() => {
    const timer = setTimeout(onReset, 2500)
    return () => clearTimeout(timer)
  }, [result, onReset])

  if (result.status === 'AUTHORIZED') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 text-center px-8">
        {/* Large green checkmark */}
        <div className="w-32 h-32 rounded-full bg-green-500 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-16 h-16"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <p className="text-5xl font-bold text-green-400">{result.studentName}</p>
          <p className="text-2xl text-gray-300 mt-2">{result.planName}</p>
        </div>
        <div className="text-xl text-gray-400">
          <p>Expire le {formatDate(result.endDate)}</p>
          <p className="text-lg mt-1">{result.daysRemaining} jour{result.daysRemaining !== 1 ? 's' : ''} restant{result.daysRemaining !== 1 ? 's' : ''}</p>
        </div>
        <p className="text-green-500 text-2xl font-bold tracking-widest">BIENVENUE</p>
      </div>
    )
  }

  if (result.status === 'DENIED_EXPIRED') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 text-center px-8">
        <div className="w-32 h-32 rounded-full bg-red-600 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-16 h-16"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
        <p className="text-4xl font-bold text-red-400">{result.studentName}</p>
        <div className="text-xl text-gray-400">
          <p>Abonnement expiré</p>
          <p className="text-lg mt-1">depuis le {formatDate(result.endDate)}</p>
        </div>
        <p className="text-red-500 text-2xl font-bold tracking-widest">ACCÈS REFUSÉ</p>
        <p className="text-gray-500 text-base">Veuillez contacter l&apos;accueil pour renouveler.</p>
      </div>
    )
  }

  if (result.status === 'DENIED_NO_SUB') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 text-center px-8">
        <div className="w-32 h-32 rounded-full bg-red-600 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-16 h-16"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
        <p className="text-4xl font-bold text-red-400">{result.studentName}</p>
        <p className="text-xl text-gray-400">Aucun abonnement actif</p>
        <p className="text-red-500 text-2xl font-bold tracking-widest">ACCÈS REFUSÉ</p>
        <p className="text-gray-500 text-base">Veuillez contacter l&apos;accueil.</p>
      </div>
    )
  }

  if (result.status === 'DENIED_UNKNOWN') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 text-center px-8">
        <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-16 h-16"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-3xl font-bold text-gray-300">QR non reconnu</p>
        <p className="text-gray-500 text-base">Contactez l&apos;accueil.</p>
      </div>
    )
  }

  if (result.status === 'ALREADY_IN') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 text-center px-8">
        <div className="w-32 h-32 rounded-full bg-yellow-500 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-16 h-16"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-4xl font-bold text-yellow-400">{result.studentName}</p>
        <p className="text-xl text-gray-400">
          Déjà présent depuis {format(parseISO(result.checkedInAt), 'HH:mm', { locale: fr })}
        </p>
      </div>
    )
  }

  return null
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/kiosk/KioskResult.tsx
git commit -m "feat(kiosk): add large-format kiosk result display component"
```

---

### Task 5: Kiosk main page

**Files:**
- Create: `apps/web/src/app/kiosk/page.tsx`
- Create: `apps/web/src/app/kiosk/KioskClient.tsx`

- [ ] **Step 1: Create the kiosk Client orchestrator**

```typescript
// apps/web/src/app/kiosk/KioskClient.tsx
'use client'

import { useState, useCallback } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { QrScanner } from '@/components/checkin/QrScanner'
import { KioskResult } from '@/components/kiosk/KioskResult'
import { checkinAction } from '@/actions/checkin/checkin-action'
import type { CheckinResult } from '@/utils/zod-schemas/checkin'

export function KioskClient() {
  const [scannerReady, setScannerReady] = useState(true)
  const [lastResult, setLastResult] = useState<CheckinResult | null>(null)

  const { execute } = useAction(checkinAction, {
    onSuccess: ({ data }) => {
      if (!data) return
      setLastResult(data)
    },
    onError: () => {
      setLastResult({ status: 'DENIED_UNKNOWN' })
    },
  })

  const handleScan = useCallback(
    (token: string) => {
      if (!scannerReady) return
      setScannerReady(false)
      execute({ qrToken: token })
    },
    [scannerReady, execute]
  )

  const handleReset = useCallback(() => {
    setLastResult(null)
    setScannerReady(true)
  }, [])

  return (
    <div className="w-screen h-screen bg-black text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-800">
        <span className="text-xl font-bold tracking-widest">SYNAPSE</span>
        <span className="text-gray-500 text-sm">Kiosque d&apos;accès</span>
      </div>

      {/* Main area */}
      <div className="flex-1 flex">
        {/* Left: scanner */}
        <div className="w-1/2 flex flex-col items-center justify-center gap-6 border-r border-gray-800 p-8">
          <p className="text-gray-400 text-sm uppercase tracking-widest">
            Présentez votre QR code
          </p>
          <QrScanner onScan={handleScan} ready={scannerReady} />
          <p className="text-gray-600 text-xs">
            Ouvrez l&apos;app Synapse → QR Code
          </p>
        </div>

        {/* Right: result */}
        <div className="w-1/2 flex items-center justify-center p-8">
          {lastResult ? (
            <KioskResult result={lastResult} onReset={handleReset} />
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-24 h-24 rounded-full border-2 border-gray-700 flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="w-12 h-12 text-gray-600"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                  />
                </svg>
              </div>
              <p className="text-gray-500 text-lg">En attente d&apos;un scan…</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: instructions */}
      <div className="border-t border-gray-800 px-8 py-3 flex items-center justify-center">
        <p className="text-gray-600 text-xs">
          En cas de problème, contactez l&apos;accueil — ne tentez pas de quitter cette page
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the kiosk Server Component page**

```typescript
// apps/web/src/app/kiosk/page.tsx
import { KioskClient } from './KioskClient'

export const metadata = {
  title: 'Synapse — Kiosque',
}

// Prevent browser back button from leaving kiosk
// Script injected as inline — does not violate CSP in development
export default function KioskPage() {
  return (
    <>
      <KioskClient />
    </>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Smoke test kiosk flow**

```bash
cd /home/sah/Synapse && pnpm dev
```

1. Open http://localhost:3000/kiosk — should redirect to `/kiosk/setup` (no session).
2. Sign in with an employee account on the setup page.
3. Should redirect to `/kiosk`.
4. Both halves render: scanner on left, idle state on right.
5. Scan a student QR → right panel shows result → auto-resets in 2.5s.
6. Attempt to navigate to `/admin` → middleware redirects employee back to `/employee/dashboard`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/kiosk/page.tsx apps/web/src/app/kiosk/KioskClient.tsx
git commit -m "feat(kiosk): add fullscreen two-panel kiosk check-in terminal"
```

---

### Task 6: Prevent kiosk escape — keyboard lock and fullscreen

**Files:**
- Create: `apps/web/src/components/kiosk/KioskGuard.tsx`

A Client Component that requests fullscreen and (where supported) the Keyboard Lock API to prevent `Alt+F4`, `Ctrl+W`, etc. This is best-effort — the kiosk device should also be locked at the OS level.

- [ ] **Step 1: Create the guard**

```typescript
// apps/web/src/components/kiosk/KioskGuard.tsx
'use client'

import { useEffect } from 'react'

/**
 * Best-effort kiosk guard:
 * 1. Requests fullscreen on mount
 * 2. Uses Keyboard Lock API (Chrome 92+) to intercept OS-level key combinations
 * 3. Disables right-click context menu
 * 4. Prevents browser navigation via beforeunload
 *
 * This is supplementary — the device should also be locked at OS level.
 */
export function KioskGuard() {
  useEffect(() => {
    // Request fullscreen
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {
        // User may have dismissed the fullscreen request — non-fatal
      })
    }

    // Keyboard Lock (Chrome 92+ only, requires fullscreen)
    if ('keyboard' in navigator && (navigator as any).keyboard?.lock) {
      ;(navigator as any).keyboard
        .lock([
          'Escape',
          'MetaLeft',
          'MetaRight',
          'AltLeft',
          'AltRight',
          'F1',
          'F2',
          'F3',
          'F4',
          'F5',
          'F11',
          'F12',
        ])
        .catch(() => {
          // Keyboard Lock not granted — non-fatal
        })
    }

    // Disable right-click
    const handleContextMenu = (e: MouseEvent) => e.preventDefault()
    document.addEventListener('contextmenu', handleContextMenu)

    // Warn before accidental navigation
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if ('keyboard' in navigator && (navigator as any).keyboard?.unlock) {
        ;(navigator as any).keyboard.unlock()
      }
    }
  }, [])

  return null
}
```

- [ ] **Step 2: Add guard to kiosk client**

In `apps/web/src/app/kiosk/KioskClient.tsx`, add `<KioskGuard />` as the first child inside the outermost div:

```typescript
import { KioskGuard } from '@/components/kiosk/KioskGuard'

// Inside return, as first child:
return (
  <div className="w-screen h-screen bg-black text-white flex flex-col">
    <KioskGuard />
    {/* rest of layout unchanged */}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/kiosk/KioskGuard.tsx \
        apps/web/src/app/kiosk/KioskClient.tsx
git commit -m "feat(kiosk): add KioskGuard for fullscreen lock and context menu disable"
```

---

### Task 7: Admin — create dedicated kiosk employee account

**Files:**
- Modify: `apps/web/src/app/admin/employees/page.tsx` (add note/instruction for kiosk setup)

This is a documentation task — no new server action needed. The existing "create employee" flow from Phase 1C is used to create a dedicated `kiosk@synapse.tn` employee account. The admin then visits the kiosk device and logs in on `/kiosk/setup`.

- [ ] **Step 1: Add kiosk instructions to admin employees page**

In `apps/web/src/app/admin/employees/page.tsx` (Phase 1C page), add an info banner below the page heading:

```typescript
{/* Kiosk setup note — add inside the existing employee page RSC */}
<div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 mb-6">
  <p className="font-medium">Configuration du kiosque d&apos;accès</p>
  <p className="mt-1 text-xs">
    Créez un compte employé dédié (ex. <code>kiosk@synapse.tn</code>), puis
    rendez-vous sur l&apos;appareil kiosque et connectez-vous via{' '}
    <strong>/kiosk/setup</strong>. Le kiosque restera connecté en permanence.
  </p>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/admin/employees/page.tsx
git commit -m "feat(admin): add kiosk setup instructions to employees page"
```

---

## Self-Review Checklist

- [ ] `/kiosk` route group has its own layout with no sidebar, no header, fullscreen black background
- [ ] Middleware allows employee/admin on `/kiosk/*` without redirect to `/employee/dashboard`
- [ ] `/kiosk/setup` is reachable without a session (login page — public within kiosk context)
- [ ] `KioskGuard` requests fullscreen and Keyboard Lock on mount — best-effort, non-fatal
- [ ] `KioskResult` auto-resets in 2.5s (vs 4s for employee view) — faster loop for kiosk
- [ ] All 5 check-in states handled with large-format display: AUTHORIZED, DENIED_EXPIRED, DENIED_NO_SUB, DENIED_UNKNOWN, ALREADY_IN
- [ ] `checkinAction` (from Phase 2B) is reused unchanged — kiosk has no special action
- [ ] `QrScanner` component (from Phase 2B) is reused unchanged
- [ ] `entry_method = 'qr_scan'` inherited from the shared `checkinAction`
- [ ] Students cannot reach `/kiosk` — middleware redirects them to `/student/dashboard`
- [ ] No navigation links in the kiosk UI — no escape to `/admin` or `/employee`
- [ ] French UI throughout — all text in French
- [ ] No `payment_method` columns introduced
