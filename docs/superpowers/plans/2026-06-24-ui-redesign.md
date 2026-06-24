# UI Redesign — Warm Brown/Orange Design System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default black/white/neutral theme with a warm brown, burnt orange, and off-white design system across all route groups (admin, employee, student PWA, kiosk).

**Architecture:** CSS custom properties in `globals.css` drive all color changes — most existing pages inherit the new palette automatically by referencing `--primary`, `--muted`, etc. Layouts (sidebar, bottom nav) are rebuilt to use the dark brown sidebar with Phosphor icons. Font stack switches from Inter to DM Sans + DM Serif Display.

**Tech Stack:** Next.js 15, Tailwind CSS v4, `@phosphor-icons/react`, `@fontsource/dm-sans`, `@fontsource/dm-serif-display`, shadcn/ui components.

## Global Constraints

- All work inside `apps/web/` — run all commands from that directory unless noted
- Install packages via `pnpm add` from `apps/web/` (not workspace root)
- No dark mode in v1 — remove `.dark` block from `globals.css`
- No emojis as UI icons anywhere — replace with Phosphor icons
- All color values must use CSS custom properties (`var(--primary)`) not hardcoded hex, except inside `globals.css` itself
- French UI — do not change any label text
- Minimum touch target 44×44px for all bottom nav tabs and buttons
- `cursor-pointer` on all interactive elements

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `apps/web/src/styles/globals.css` | Modify | Replace CSS color tokens, add font imports, remove dark mode |
| `apps/web/src/app/layout.tsx` | Modify | Switch from Inter localFont to DM Sans CSS variable |
| `apps/web/src/app/admin/layout.tsx` | Modify | Dark brown sidebar with Phosphor icons |
| `apps/web/src/app/employee/layout.tsx` | Modify | Dark brown sidebar with Phosphor icons (employee nav items) |
| `apps/web/src/app/student/layout.tsx` | Modify | Top bar + bottom nav with Phosphor icons |
| `apps/web/src/app/kiosk/layout.tsx` | Modify | Background from `bg-black` to `#2C1A0E` via CSS var |
| `apps/web/src/components/kiosk/KioskResult.tsx` | Modify | Replace hardcoded Tailwind color classes with palette-aligned values |
| `apps/web/src/app/student/dashboard/page.tsx` | Modify | Remove ⚠️ emoji, replace with Phosphor WarningCircle icon |

---

### Task 1: Install dependencies and rewrite CSS foundation

**Files:**
- Modify: `apps/web/src/styles/globals.css`
- Modify: `apps/web/src/app/layout.tsx`

**Interfaces:**
- Produces: CSS custom properties used by all subsequent tasks:
  - `--background`, `--foreground`, `--primary`, `--primary-foreground`
  - `--sidebar-bg`, `--sidebar-text`, `--sidebar-muted`, `--sidebar-active-bg`, `--sidebar-active-text`, `--sidebar-active-border`
  - `--primary-light`, `--border`, `--muted`, `--muted-foreground`
  - `--success`, `--success-foreground`, `--warning`, `--warning-foreground`
  - `--font-dm-sans`, `--font-dm-serif`

- [ ] **Step 1: Install packages**

```bash
cd apps/web
pnpm add @phosphor-icons/react @fontsource/dm-sans @fontsource/dm-serif-display
```

Expected: packages added to `apps/web/package.json`, no errors.

- [ ] **Step 2: Replace `globals.css`**

Open `apps/web/src/styles/globals.css`. Replace the entire `:root { ... }` block and `.dark { ... }` block with the following. Keep everything before and after those blocks (the `@import`, `@plugin`, `@source` lines at the top, and any utility classes at the bottom).

New `:root` block (replaces existing `:root` AND removes `.dark` entirely):

```css
:root {
  /* Backgrounds */
  --background: #FAFAF8;
  --foreground: #1C1009;
  --surface: #FFFFFF;

  /* Cards / Popovers */
  --card: #FFFFFF;
  --card-foreground: #1C1009;
  --popover: #FFFFFF;
  --popover-foreground: #1C1009;

  /* Primary — burnt orange */
  --primary: #C4622D;
  --primary-foreground: #FFFFFF;
  --primary-hover: #A8501F;
  --primary-light: #FDF0E8;

  /* Secondary */
  --secondary: #F3EDE6;
  --secondary-foreground: #1C1009;

  /* Muted */
  --muted: #F3EDE6;
  --muted-foreground: #8C7B6E;

  /* Accent */
  --accent: #FDF0E8;
  --accent-foreground: #C4622D;

  /* Borders & Inputs */
  --border: #E8DDD4;
  --input: #E8DDD4;
  --ring: #C4622D;

  /* Destructive */
  --destructive: #DC2626;
  --destructive-foreground: #FFFFFF;

  /* Status */
  --success: #16A34A;
  --success-foreground: #DCFCE7;
  --warning: #D97706;
  --warning-foreground: #FEF3C7;

  /* Radius */
  --radius: 0.5rem;

  /* Sidebar */
  --sidebar: #2C1A0E;
  --sidebar-foreground: #F5EDE3;
  --sidebar-muted: #A08060;
  --sidebar-primary: #C4622D;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: rgba(245, 237, 227, 0.08);
  --sidebar-accent-foreground: #F5EDE3;
  --sidebar-border: rgba(255, 255, 255, 0.08);
  --sidebar-ring: #C4622D;
  --sidebar-active-bg: #FDF0E8;
  --sidebar-active-text: #C4622D;
  --sidebar-active-border: #C4622D;

  /* Charts */
  --chart-1: #C4622D;
  --chart-2: #F59E0B;
  --chart-3: #16A34A;
  --chart-4: #6B7280;
  --chart-5: #A8501F;
}
```

Also add at the bottom of `globals.css`, before any existing utility classes:

```css
/* Focus ring */
*:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Update `layout.tsx` to use DM fonts**

Replace the entire `apps/web/src/app/layout.tsx` with:

```tsx
import '@/styles/globals.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/dm-serif-display/400.css'
import { DynamicLayoutProviders } from './DynamicLayoutProviders'

export const metadata = {
  title: 'Synapse Management Platform',
  description: "Gestion de l'espace de coworking Synapse",
  manifest: '/manifest.json',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head />
      <body style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <DynamicLayoutProviders>
          {children}
        </DynamicLayoutProviders>
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Verify build passes**

```bash
cd apps/web
pnpm build
```

Expected: build completes with no type errors. Font import warnings are fine. Fix any errors before continuing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/styles/globals.css apps/web/src/app/layout.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(ui): install DM fonts + Phosphor icons, rewrite CSS color tokens to warm palette"
```

---

### Task 2: Admin sidebar redesign

**Files:**
- Modify: `apps/web/src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: `--sidebar`, `--sidebar-foreground`, `--sidebar-muted`, `--sidebar-active-bg`, `--sidebar-active-text`, `--sidebar-active-border` from Task 1
- Produces: Admin layout with dark brown sidebar, Phosphor icons, burnt orange active states

- [ ] **Step 1: Rewrite `apps/web/src/app/admin/layout.tsx`**

```tsx
import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { signOutAction } from '@/data/auth/sign-out'
import {
  ChartBar,
  Users,
  UserCircle,
  CreditCard,
  SignOut,
} from '@phosphor-icons/react/dist/ssr'

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

  const navItems = [
    { href: '/admin/dashboard', label: 'Tableau de bord', Icon: ChartBar },
    { href: '/admin/students', label: 'Étudiants', Icon: Users },
    { href: '/admin/employees', label: 'Employés', Icon: UserCircle },
    { href: '/admin/subscription-plans', label: 'Formules', Icon: CreditCard },
  ]

  return (
    <div className="flex min-h-screen">
      <aside
        className="w-60 flex flex-col shrink-0"
        style={{ backgroundColor: 'var(--sidebar)' }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
          <p
            className="text-lg tracking-tight"
            style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--sidebar-foreground)' }}
          >
            Synapse
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--sidebar-muted)' }}>
            Administration
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors duration-150 cursor-pointer group"
              style={{ color: 'var(--sidebar-foreground)' }}
            >
              <Icon size={18} weight="regular" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--sidebar-border)' }}>
          <p className="text-xs font-medium truncate" style={{ color: 'var(--sidebar-foreground)' }}>
            {profile.full_name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--sidebar-muted)' }}>
            Administrateur
          </p>
          <form action={signOutAction} className="mt-2">
            <button
              type="submit"
              className="flex items-center gap-1.5 text-xs cursor-pointer transition-colors duration-150"
              style={{ color: 'var(--sidebar-muted)' }}
            >
              <SignOut size={14} />
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 p-6" style={{ backgroundColor: 'var(--background)' }}>
        {children}
      </main>
    </div>
  )
}
```

**Note on active states:** Tailwind v4 doesn't support server-component `usePathname` for active link detection in RSC layouts. The active state will be added in Task 6 via a `NavLink` client component. For now, hover states use CSS via a `<style>` tag injected below — add this inside the `<aside>` before the closing tag:

```tsx
        <style>{`
          nav a:hover {
            background-color: var(--sidebar-accent);
          }
        `}</style>
```

- [ ] **Step 2: Build check**

```bash
cd apps/web
pnpm build
```

Expected: no type errors. Admin layout compiles.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/admin/layout.tsx
git commit -m "feat(ui): rebuild admin sidebar with dark brown palette and Phosphor icons"
```

---

### Task 3: Employee sidebar redesign

**Files:**
- Modify: `apps/web/src/app/employee/layout.tsx`

**Interfaces:**
- Consumes: same sidebar CSS vars from Task 1
- Produces: Employee layout with identical sidebar style, employee-specific nav items

- [ ] **Step 1: Rewrite `apps/web/src/app/employee/layout.tsx`**

```tsx
import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { signOutAction } from '@/data/auth/sign-out'
import {
  ChartBar,
  Users,
  ShoppingCart,
  QrCode,
  SignOut,
} from '@phosphor-icons/react/dist/ssr'

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

  const navItems = [
    { href: '/employee/dashboard', label: 'Tableau de bord', Icon: ChartBar },
    { href: '/employee/students', label: 'Étudiants', Icon: Users },
    { href: '/employee/pos', label: 'Caisse', Icon: ShoppingCart },
    { href: '/employee/checkin', label: 'Contrôle accès', Icon: QrCode },
  ]

  return (
    <div className="flex min-h-screen">
      <aside
        className="w-60 flex flex-col shrink-0"
        style={{ backgroundColor: 'var(--sidebar)' }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
          <p
            className="text-lg tracking-tight"
            style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--sidebar-foreground)' }}
          >
            Synapse
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--sidebar-muted)' }}>
            Accueil
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors duration-150 cursor-pointer"
              style={{ color: 'var(--sidebar-foreground)' }}
            >
              <Icon size={18} weight="regular" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--sidebar-border)' }}>
          <p className="text-xs font-medium truncate" style={{ color: 'var(--sidebar-foreground)' }}>
            {profile.full_name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--sidebar-muted)' }}>
            {profile.role === 'admin' ? 'Administrateur' : 'Employé'}
          </p>
          <form action={signOutAction} className="mt-2">
            <button
              type="submit"
              className="flex items-center gap-1.5 text-xs cursor-pointer transition-colors duration-150"
              style={{ color: 'var(--sidebar-muted)' }}
            >
              <SignOut size={14} />
              Déconnexion
            </button>
          </form>
        </div>

        <style>{`
          nav a:hover {
            background-color: var(--sidebar-accent);
          }
        `}</style>
      </aside>

      <main className="flex-1 p-6" style={{ backgroundColor: 'var(--background)' }}>
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Build check**

```bash
cd apps/web
pnpm build
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/employee/layout.tsx
git commit -m "feat(ui): rebuild employee sidebar with dark brown palette and Phosphor icons"
```

---

### Task 4: Student PWA layout redesign

**Files:**
- Modify: `apps/web/src/app/student/layout.tsx`

**Interfaces:**
- Consumes: `--primary`, `--border`, `--background`, `--muted-foreground` from Task 1
- Produces: Student layout with branded top bar, bottom nav with Phosphor icons and burnt orange active states

**Note:** Active tab detection requires `usePathname` which is a client hook. The bottom nav must be a `'use client'` component.

- [ ] **Step 1: Create `apps/web/src/components/student/StudentBottomNav.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CreditCard, QrCode, MapPin, Star } from '@phosphor-icons/react'

const tabs = [
  { href: '/student/dashboard', label: 'Abonnement', Icon: CreditCard },
  { href: '/student/qr', label: 'QR Code', Icon: QrCode },
  { href: '/student/reservation', label: 'Réserver', Icon: MapPin },
  { href: '/student/loyalty', label: 'Points', Icon: Star },
]

export function StudentBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 inset-x-0 flex border-t"
      style={{
        backgroundColor: 'var(--surface, #fff)',
        borderColor: 'var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1 cursor-pointer transition-colors duration-150"
            style={{
              color: active ? 'var(--primary)' : 'var(--muted-foreground)',
              minHeight: '44px',
            }}
          >
            <Icon size={22} weight={active ? 'bold' : 'regular'} />
            <span className="text-[11px] font-medium leading-none">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Rewrite `apps/web/src/app/student/layout.tsx`**

```tsx
import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { signOutAction } from '@/data/auth/sign-out'
import { Bell } from '@phosphor-icons/react/dist/ssr'
import { StudentBottomNav } from '@/components/student/StudentBottomNav'

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

  const initials = profile.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?'

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
      {/* Top bar */}
      <header
        className="shrink-0 flex items-center justify-between px-4 border-b"
        style={{
          height: '56px',
          backgroundColor: 'var(--surface, #fff)',
          borderColor: 'var(--border)',
        }}
      >
        <span
          className="text-base tracking-tight"
          style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--foreground)' }}
        >
          Synapse
        </span>

        <div className="flex items-center gap-3">
          {/* Notification bell — slot for Phase 6 */}
          <button
            type="button"
            className="cursor-pointer transition-colors duration-150"
            aria-label="Notifications"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <Bell size={20} weight="regular" />
          </button>

          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
            style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
          >
            {initials}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 px-4 pt-4 pb-24">
        {children}
      </main>

      <StudentBottomNav />
    </div>
  )
}
```

- [ ] **Step 3: Build check**

```bash
cd apps/web
pnpm build
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/student/layout.tsx apps/web/src/components/student/StudentBottomNav.tsx
git commit -m "feat(ui): rebuild student PWA layout with branded top bar and Phosphor bottom nav"
```

---

### Task 5: Kiosk theme + KioskResult color update

**Files:**
- Modify: `apps/web/src/app/kiosk/layout.tsx`
- Modify: `apps/web/src/components/kiosk/KioskResult.tsx`

**Interfaces:**
- Consumes: `--sidebar` (deep brown) from Task 1
- Produces: Kiosk with warm dark brown background; result states use palette-aligned colors

- [ ] **Step 1: Update `apps/web/src/app/kiosk/layout.tsx`**

Replace the return statement only (keep the auth guard logic above it):

```tsx
  return (
    <div
      className="text-white w-screen h-screen overflow-hidden fixed inset-0"
      style={{ backgroundColor: 'var(--sidebar)' }}
    >
      {children}
    </div>
  )
```

- [ ] **Step 2: Update `apps/web/src/components/kiosk/KioskResult.tsx`**

Replace only the color class names in each state block. The logic, layout, and SVG icons stay identical — only color classes change:

**AUTHORIZED state** — change:
- `bg-green-500` → `bg-[#16A34A]`
- `text-green-400` → `text-[#4ADE80]`
- `text-gray-300` → `text-[#D6C4B0]`
- `text-gray-400` → `text-[#A08060]`
- `text-green-500` → `text-[#4ADE80]`

**DENIED_EXPIRED state** — change:
- `bg-red-600` → `bg-[#DC2626]`
- `text-red-400` → `text-[#FCA5A5]`
- `text-gray-400` → `text-[#A08060]`
- `text-red-500` → `text-[#FCA5A5]`
- `text-gray-500` → `text-[#8C7B6E]`

**DENIED_NO_SUB state** — same substitutions as DENIED_EXPIRED.

**DENIED_UNKNOWN state** — change:
- `bg-gray-700` → `bg-[#3D2314]`
- `text-gray-300` → `text-[#D6C4B0]`
- `text-gray-500` → `text-[#8C7B6E]`

**ALREADY_IN state** — change:
- `bg-yellow-500` → `bg-[#D97706]`
- `text-yellow-400` → `text-[#FCD34D]`
- `text-gray-400` → `text-[#A08060]`

- [ ] **Step 3: Build check**

```bash
cd apps/web
pnpm build
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/kiosk/layout.tsx apps/web/src/components/kiosk/KioskResult.tsx
git commit -m "feat(ui): update kiosk to warm dark brown background and palette-aligned result colors"
```

---

### Task 6: Student dashboard — remove emoji, add sidebar active nav component

**Files:**
- Modify: `apps/web/src/app/student/dashboard/page.tsx`
- Create: `apps/web/src/components/ui/sidebar-nav-link.tsx`
- Modify: `apps/web/src/app/admin/layout.tsx`
- Modify: `apps/web/src/app/employee/layout.tsx`

**Interfaces:**
- Consumes: `StudentBottomNav` pattern from Task 4 (same `usePathname` approach)
- Produces: No emojis in UI; sidebar links highlight active route with burnt orange left border

- [ ] **Step 1: Create `apps/web/src/components/ui/sidebar-nav-link.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'

interface SidebarNavLinkProps {
  href: string
  label: string
  Icon: PhosphorIcon
}

export function SidebarNavLink({ href, label, Icon }: SidebarNavLinkProps) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors duration-150 cursor-pointer border-l-2"
      style={{
        color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-foreground)',
        backgroundColor: active ? 'var(--sidebar-active-bg)' : 'transparent',
        borderLeftColor: active ? 'var(--sidebar-active-border)' : 'transparent',
      }}
    >
      <Icon size={18} weight={active ? 'bold' : 'regular'} />
      {label}
    </Link>
  )
}
```

- [ ] **Step 2: Update `apps/web/src/app/admin/layout.tsx` to use `SidebarNavLink`**

Replace the `navItems.map` section inside `<nav>`:

```tsx
import { SidebarNavLink } from '@/components/ui/sidebar-nav-link'

// Inside <nav>:
{navItems.map(({ href, label, Icon }) => (
  <SidebarNavLink key={href} href={href} label={label} Icon={Icon} />
))}
```

Also remove the `<style>` tag added in Task 2 (no longer needed — active state is handled by the component).

- [ ] **Step 3: Update `apps/web/src/app/employee/layout.tsx` the same way**

Same replacement as Step 2: import `SidebarNavLink`, update the `navItems.map`, remove the `<style>` tag.

- [ ] **Step 4: Remove emoji from `apps/web/src/app/student/dashboard/page.tsx`**

Find this block:

```tsx
          {daysRemaining <= 3 && (
            <p className="mt-2 text-xs opacity-90">
              ⚠️ Votre abonnement expire bientôt — contactez l'accueil pour renouveler
            </p>
          )}
```

Replace with:

```tsx
import { WarningCircle } from '@phosphor-icons/react/dist/ssr'

// ...

          {daysRemaining <= 3 && (
            <p className="mt-2 text-xs opacity-90 flex items-center gap-1">
              <WarningCircle size={14} weight="bold" />
              Votre abonnement expire bientôt — contactez l&apos;accueil pour renouveler
            </p>
          )}
```

- [ ] **Step 5: Build check**

```bash
cd apps/web
pnpm build
```

Expected: no type errors. All layouts compile cleanly.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ui/sidebar-nav-link.tsx apps/web/src/app/admin/layout.tsx apps/web/src/app/employee/layout.tsx apps/web/src/app/student/dashboard/page.tsx
git commit -m "feat(ui): add active sidebar nav links, remove emoji from student dashboard"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Warm brown/orange/white palette | Task 1 |
| DM Sans + DM Serif Display fonts | Task 1 |
| Phosphor Icons | Tasks 2–6 |
| Admin sidebar dark brown `#2C1A0E` | Task 2 |
| Employee sidebar dark brown | Task 3 |
| Student PWA bottom nav with active states | Task 4 |
| Student top bar with notification bell slot | Task 4 |
| Kiosk dark brown background | Task 5 |
| KioskResult palette-aligned colors | Task 5 |
| No emojis as icons | Task 6 |
| Active sidebar states burnt orange | Task 6 |
| Focus ring `#C4622D` | Task 1 (globals.css) |
| `prefers-reduced-motion` | Task 1 (globals.css) |
| `cursor-pointer` on interactive elements | Tasks 2–6 (all links/buttons) |
| Minimum 44px touch targets (bottom nav) | Task 4 (`minHeight: '44px'`) |
| No dark mode | Task 1 (`.dark` block removed) |

**Placeholder scan:** None found. All steps contain exact code.

**Type consistency:**
- `SidebarNavLink` props: `href: string`, `label: string`, `Icon: PhosphorIcon` — used identically in Task 6 Steps 2 and 3.
- `StudentBottomNav` uses `usePathname` same pattern as `SidebarNavLink` — consistent.
- Phosphor SSR imports (`/dist/ssr`) used in all Server Components; client-side imports (no suffix) in Client Components — consistent.
