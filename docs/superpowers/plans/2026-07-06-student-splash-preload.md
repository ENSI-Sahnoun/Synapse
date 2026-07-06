# Student Splash / Preload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **BUILD NOTE:** The wordmark animation design in Task 2 is to be produced by the **Fable design agent** (`model: fable`). The rest of the plumbing (mount, once-per-cold-open gate) is standard.

**Goal:** On every cold open of the student app, show a short branded "Synapse" wordmark animation that covers the initial warm-up, then reveals the app. Route prefetch already exists (`RoutePrefetcher`), so the splash's job is purely the branded cover during warm-up.

**Architecture:** A client `StudentSplash` overlay mounted in the student layout. A module-scope boolean gates it to once per JS context (PWA cold start = fresh context), so client navigations within a session never re-trigger it. Framer Motion (`motion` v12, already a dependency) animates a text wordmark; min display ~1.5s then fade out.

**Tech Stack:** Next.js App Router client component, `motion` (Framer Motion v12), CSS variables from the design system (`--font-display`, brand colors).

## Global Constraints

- Package for animation: `motion` (already in `apps/web/package.json`, v12). Import from `'motion/react'`.
- Wordmark text: **"Synapse"** (app name). No image asset required.
- Show on EVERY cold open, once per JS context — use a module-level boolean, NOT sessionStorage/localStorage.
- Student layout only (`apps/web/src/app/student/layout.tsx`). Staff and kiosk never see it.
- Do NOT add a second route prefetcher — `RoutePrefetcher` (layout line 53) already warms `STUDENT_ROUTES`. The splash only provides visual cover.
- Overlay must be `fixed inset-0`, above all content, and must not block interaction after it fades (unmount or `pointer-events-none` + removed from tree).
- Min display ~1500ms; fade-out ~400ms.

---

### Task 1: `StudentSplash` component — plumbing + once-per-cold-open gate

**Files:**
- Create: `apps/web/src/components/student/StudentSplash.tsx`

**Interfaces:**
- Produces: default-exported `<StudentSplash />` client component. Renders the overlay on first mount per JS context; renders `null` thereafter and after it finishes.

- [ ] **Step 1: Write the baseline component (animation refined in Task 2)**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

// Module scope: true for the first mount in this JS context only. A PWA cold
// start creates a fresh context (this resets); client navigations do not.
let shownThisContext = false

const MIN_DISPLAY_MS = 1500

export default function StudentSplash() {
  const [visible, setVisible] = useState(() => !shownThisContext)

  useEffect(() => {
    if (shownThisContext) return
    shownThisContext = true
    const t = setTimeout(() => setVisible(false), MIN_DISPLAY_MS)
    return () => clearTimeout(t)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="student-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--background)',
          }}
        >
          {/* Wordmark — animation refined in Task 2 (Fable agent) */}
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 40,
              fontWeight: 700,
              color: 'var(--accent-brand)',
            }}
          >
            Synapse
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: no errors. If the import path `'motion/react'` errors, confirm the entry with `node -e "console.log(require.resolve('motion/react'))"` from `apps/web` and adjust.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/student/StudentSplash.tsx
git commit -m "feat: add StudentSplash overlay (baseline)"
```

---

### Task 2: Design the wordmark animation (Fable agent)

**Files:**
- Modify: `apps/web/src/components/student/StudentSplash.tsx` (the wordmark render + entrance animation only)

**Interfaces:**
- Consumes: the `visible`/`AnimatePresence` scaffold from Task 1. Only the inner wordmark markup and its `motion` animation change; the gating logic and timings stay.

- [ ] **Step 1: Produce the animated wordmark with the Fable design agent**

Dispatch the Fable design agent (`model: fable`) to design a distinctive entrance animation for the "Synapse" wordmark using `motion` — e.g. per-letter stagger, subtle scale/blur-in, brand-color accent. Constraints for the agent: keep total entrance under ~1200ms so it completes within `MIN_DISPLAY_MS`; use `var(--font-display)` and `var(--accent-brand)`; no external assets; must render inside the existing `motion.div` overlay.

- [ ] **Step 2: Typecheck + visual check**

Run: `cd apps/web && pnpm tsc --noEmit`
Then cold-open the student app (see Task 3) and confirm the wordmark animates in cleanly, then the overlay fades.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/student/StudentSplash.tsx
git commit -m "feat: animated Synapse wordmark splash (fable)"
```

---

### Task 3: Mount in the student layout

**Files:**
- Modify: `apps/web/src/app/student/layout.tsx`

**Interfaces:**
- Consumes: `<StudentSplash />` from Task 1.

- [ ] **Step 1: Import and mount**

Add the import near the other component imports at the top of `apps/web/src/app/student/layout.tsx`:

```tsx
import StudentSplash from '@/components/student/StudentSplash'
```

Mount it as the first child inside the root `<div className="min-h-screen ...">`, before `<RoutePrefetcher ... />`:

```tsx
      <StudentSplash />
```

- [ ] **Step 2: Manual verification**

1. Cold-open the student app (hard reload / relaunch PWA): the "Synapse" wordmark plays, then fades to reveal the app (~1.5s). During it, `RoutePrefetcher` warms routes → subsequent navigations feel instant.
2. Navigate between student tabs: splash does NOT reappear (module gate).
3. Load an employee or kiosk route: no splash.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/student/layout.tsx
git commit -m "feat: show StudentSplash on student app cold open"
```

---

## Self-Review

- **Spec coverage:** Student-layout-only mount (Task 3), every-cold-open once-per-context gate (Task 1 module boolean), app-name wordmark via Framer Motion (Tasks 1–2), Fable agent for the animation (Task 2), no duplicate prefetch since `RoutePrefetcher` exists (noted in constraints). Covered.
- **Placeholder scan:** Task 2 intentionally delegates the creative animation to the Fable agent per the user's instruction — the scaffold, gate, timings, and constraints are fully specified; only the artistic entrance is produced by that agent.
- **Type consistency:** `StudentSplash` default export, no props, consumed identically in Task 3. `MIN_DISPLAY_MS` constant referenced in Task 2 constraints. Consistent.
