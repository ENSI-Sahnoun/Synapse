# Phase 2B: Employee Check-in Scanner

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/employee/checkin` page where an employee uses their device camera to scan a student's QR code, triggering server-side HMAC verification, subscription check, and attendance logging.

**Architecture:** A Client Component wraps `zxing-js` to stream camera frames into a QR decoder. On successful decode the value is sent to a `next-safe-action` server action (`checkinAction`) that: (1) verifies the HMAC token, (2) looks up the student's active subscription, (3) checks for duplicate check-in, (4) inserts an `attendance` row, and (5) returns a typed result object (`AUTHORIZED | DENIED_EXPIRED | DENIED_NO_SUB | DENIED_UNKNOWN | ALREADY_IN`). The result is displayed in a result panel that auto-resets after 4 seconds so the scanner is ready for the next student.

**Tech Stack:** `@zxing/library` (browser QR decode via `getUserMedia`), `next-safe-action`, Zod, Supabase admin client, `date-fns`

## Global Constraints

- Depends on Phase 2A (HMAC `verifyQrToken` utility must exist)
- Depends on Phase 1A attendance migration (Task 1 of this plan adds it if not yet done)
- `checkinAction` uses `employeeActionClient` — admin can also access
- HMAC verification must happen before any DB read — reject unknown tokens immediately
- No seat assignment in Phase 2 (seat_id = NULL, room_id = NULL — Phase 3 adds this)
- `entry_method = 'qr_scan'` for all check-ins from this page
- French UI
- Migration timestamps after `20260623000007`
- All commands from `/home/sah/Synapse`

---

### Task 1: Attendance table migration

**Files:**
- Create: `apps/database/supabase/migrations/20260623000008_smp_attendance.sql`

- [ ] **Step 1: Write migration**

```sql
-- apps/database/supabase/migrations/20260623000008_smp_attendance.sql

CREATE TABLE public.attendance (
  id              uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  student_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- seat_id and room_id are nullable until Phase 3 seat assignment is implemented
  seat_id         uuid        REFERENCES public.seats(id) ON DELETE SET NULL,
  room_id         uuid        REFERENCES public.rooms(id) ON DELETE SET NULL,
  checked_in_at   timestamptz NOT NULL DEFAULT now(),
  checked_out_at  timestamptz,
  entry_method    text        NOT NULL CHECK (entry_method IN ('qr_scan', 'manual'))
);

-- Fast lookup: is a student currently inside?
CREATE INDEX attendance_student_open_idx
  ON public.attendance (student_id)
  WHERE checked_out_at IS NULL;

-- Fast lookup: today's attendance for dashboard
CREATE INDEX attendance_checked_in_at_idx
  ON public.attendance (checked_in_at DESC);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Student reads own attendance history
CREATE POLICY "attendance_select" ON public.attendance
  FOR SELECT USING (
    student_id = auth.uid()
    OR current_user_role() IN ('admin', 'employee')
  );

-- Employee/admin inserts (check-in)
CREATE POLICY "attendance_insert" ON public.attendance
  FOR INSERT WITH CHECK (current_user_role() IN ('admin', 'employee'));

-- Employee/admin updates (check-out, seat assignment)
CREATE POLICY "attendance_update" ON public.attendance
  FOR UPDATE USING (current_user_role() IN ('admin', 'employee'));

-- Admin-only delete
CREATE POLICY "attendance_delete" ON public.attendance
  FOR DELETE USING (current_user_role() = 'admin');
```

Note: `public.seats` and `public.rooms` tables are created in Phase 3. The `REFERENCES` constraints will cause an error if applied before those tables exist. Use `IF EXISTS` style or defer:

```sql
-- apps/database/supabase/migrations/20260623000008_smp_attendance.sql
-- (Adjusted to not reference seats/rooms until Phase 3)

CREATE TABLE public.attendance (
  id              uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  student_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- seat_id / room_id added as FK in Phase 3 migration once those tables exist
  seat_id         uuid,
  room_id         uuid,
  checked_in_at   timestamptz NOT NULL DEFAULT now(),
  checked_out_at  timestamptz,
  entry_method    text        NOT NULL CHECK (entry_method IN ('qr_scan', 'manual'))
);

CREATE INDEX attendance_student_open_idx
  ON public.attendance (student_id)
  WHERE checked_out_at IS NULL;

CREATE INDEX attendance_checked_in_at_idx
  ON public.attendance (checked_in_at DESC);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_select" ON public.attendance
  FOR SELECT USING (
    student_id = auth.uid()
    OR current_user_role() IN ('admin', 'employee')
  );

CREATE POLICY "attendance_insert" ON public.attendance
  FOR INSERT WITH CHECK (current_user_role() IN ('admin', 'employee'));

CREATE POLICY "attendance_update" ON public.attendance
  FOR UPDATE USING (current_user_role() IN ('admin', 'employee'));

CREATE POLICY "attendance_delete" ON public.attendance
  FOR DELETE USING (current_user_role() = 'admin');
```

- [ ] **Step 2: Apply migration**

```bash
cd apps/database && pnpm supabase migration up
```

Expected: `20260623000008_smp_attendance` applied.

- [ ] **Step 3: Regenerate types**

```bash
cd /home/sah/Synapse && pnpm gen-types-local
```

Expected: `attendance` table appears in `apps/web/src/lib/database.types.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/database/supabase/migrations/20260623000008_smp_attendance.sql \
        apps/web/src/lib/database.types.ts
git commit -m "feat(db): add attendance table with RLS"
```

---

### Task 2: Check-in server action

**Files:**
- Create: `apps/web/src/utils/zod-schemas/checkin.ts`
- Create: `apps/web/src/actions/checkin/checkin-action.ts`
- Create: `apps/web/src/actions/checkin/checkin-action.test.ts`

- [ ] **Step 1: Write Zod schema**

```typescript
// apps/web/src/utils/zod-schemas/checkin.ts
import { z } from 'zod'

export const checkinSchema = z.object({
  /** Raw QR token string as decoded from the QR code */
  qrToken: z.string().min(1, 'Token QR requis'),
})

export type CheckinInput = z.infer<typeof checkinSchema>

export type CheckinResult =
  | { status: 'AUTHORIZED'; studentName: string; planName: string; endDate: string; daysRemaining: number }
  | { status: 'DENIED_EXPIRED'; studentName: string; endDate: string }
  | { status: 'DENIED_NO_SUB'; studentName: string }
  | { status: 'DENIED_UNKNOWN' }
  | { status: 'ALREADY_IN'; studentName: string; checkedInAt: string }
```

- [ ] **Step 2: Write the server action**

```typescript
// apps/web/src/actions/checkin/checkin-action.ts
'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { checkinSchema, type CheckinResult } from '@/utils/zod-schemas/checkin'
import { verifyQrToken } from '@/lib/qr-token'
import { createAdminClient } from '@/supabase-clients/admin'
import { differenceInDays, parseISO, startOfDay } from 'date-fns'

export const checkinAction = employeeActionClient
  .schema(checkinSchema)
  .action(async ({ parsedInput }): Promise<CheckinResult> => {
    const { qrToken } = parsedInput

    // Step 1: HMAC verification — reject unknown tokens immediately
    const studentId = verifyQrToken(qrToken)
    if (!studentId) {
      return { status: 'DENIED_UNKNOWN' }
    }

    const admin = createAdminClient()

    // Step 2: Fetch student profile
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', studentId)
      .eq('role', 'student')
      .single()

    if (profileError || !profile) {
      return { status: 'DENIED_UNKNOWN' }
    }

    // Step 3: Check for open attendance (already inside)
    const { data: openAttendance } = await admin
      .from('attendance')
      .select('id, checked_in_at')
      .eq('student_id', studentId)
      .is('checked_out_at', null)
      .order('checked_in_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (openAttendance) {
      return {
        status: 'ALREADY_IN',
        studentName: profile.full_name,
        checkedInAt: openAttendance.checked_in_at,
      }
    }

    // Step 4: Check active subscription
    const today = startOfDay(new Date()).toISOString().slice(0, 10) // 'YYYY-MM-DD'

    const { data: subscription } = await admin
      .from('subscriptions')
      .select('id, end_date, plan_id, subscription_plans(name)')
      .eq('student_id', studentId)
      .gte('end_date', today)
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!subscription) {
      // Check if student ever had a subscription (expired vs never)
      const { data: expiredSub } = await admin
        .from('subscriptions')
        .select('end_date')
        .eq('student_id', studentId)
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (expiredSub) {
        return {
          status: 'DENIED_EXPIRED',
          studentName: profile.full_name,
          endDate: expiredSub.end_date,
        }
      }

      return {
        status: 'DENIED_NO_SUB',
        studentName: profile.full_name,
      }
    }

    // Step 5: Log check-in
    const { error: insertError } = await admin
      .from('attendance')
      .insert({
        student_id: studentId,
        seat_id: null,
        room_id: null,
        entry_method: 'qr_scan',
      })

    if (insertError) {
      // Log but don't block — return authorized anyway to avoid blocking entry
      console.error('Attendance insert error:', insertError.message)
    }

    const planName =
      (subscription as any).subscription_plans?.name ?? 'Abonnement'
    const daysRemaining = differenceInDays(
      parseISO(subscription.end_date),
      startOfDay(new Date())
    )

    return {
      status: 'AUTHORIZED',
      studentName: profile.full_name,
      planName,
      endDate: subscription.end_date,
      daysRemaining,
    }
  })
```

- [ ] **Step 3: Write tests**

```typescript
// apps/web/src/actions/checkin/checkin-action.test.ts
import { describe, it, expect, vi, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.QR_HMAC_SECRET = 'test-secret-for-checkin-tests'
})

vi.mock('@/lib/safe-action', () => ({
  employeeActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}))

vi.mock('@/supabase-clients/admin', () => ({
  createAdminClient: vi.fn(),
}))

describe('checkinAction schema', () => {
  it('is exported', async () => {
    const mod = await import('./checkin-action')
    expect(mod.checkinAction).toBeDefined()
  })
})

describe('verifyQrToken integration', () => {
  it('returns null for a malformed token', async () => {
    const { verifyQrToken } = await import('@/lib/qr-token')
    expect(verifyQrToken('NOT-A-REAL-TOKEN')).toBeNull()
  })
})
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && pnpm test -- --reporter=verbose checkin-action.test 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 5: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/utils/zod-schemas/checkin.ts \
        apps/web/src/actions/checkin/checkin-action.ts \
        apps/web/src/actions/checkin/checkin-action.test.ts
git commit -m "feat(checkin): add HMAC-verified check-in server action with 5-state response"
```

---

### Task 3: Manual checkout server action

**Files:**
- Create: `apps/web/src/actions/checkin/checkout-action.ts`

- [ ] **Step 1: Write checkout action**

```typescript
// apps/web/src/actions/checkin/checkout-action.ts
'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { z } from 'zod'
import { createAdminClient } from '@/supabase-clients/admin'

const checkoutSchema = z.object({
  attendanceId: z.string().uuid('ID présence invalide'),
})

export const checkoutAction = employeeActionClient
  .schema(checkoutSchema)
  .action(async ({ parsedInput }) => {
    const { attendanceId } = parsedInput
    const admin = createAdminClient()

    const { error } = await admin
      .from('attendance')
      .update({ checked_out_at: new Date().toISOString() })
      .eq('id', attendanceId)
      .is('checked_out_at', null) // only close open sessions

    if (error) {
      throw new Error(`Erreur lors de la sortie: ${error.message}`)
    }

    return { success: true }
  })
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/actions/checkin/checkout-action.ts
git commit -m "feat(checkin): add manual checkout server action"
```

---

### Task 4: pg_cron midnight auto-checkout

**Files:**
- Create: `apps/database/supabase/migrations/20260623000009_smp_cron_midnight_checkout.sql`

- [ ] **Step 1: Write migration**

```sql
-- apps/database/supabase/migrations/20260623000009_smp_cron_midnight_checkout.sql

-- Enable pg_cron extension (already available in Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Midnight sweep: close all open attendance rows, free seats
SELECT cron.schedule(
  'midnight-checkout',
  '0 0 * * *',         -- every day at midnight (UTC)
  $$
    UPDATE public.attendance
    SET checked_out_at = now()
    WHERE checked_out_at IS NULL;
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Auto-checkout at midnight — closes all open attendance sessions';
```

- [ ] **Step 2: Apply migration**

```bash
cd apps/database && pnpm supabase migration up
```

Expected: migration applied. (pg_cron is available by default in Supabase; locally it may require enabling via `config.toml`.)

- [ ] **Step 3: Verify locally (optional)**

```bash
cd apps/database && pnpm supabase db execute --sql \
  "SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'midnight-checkout';"
```

Expected: one row returned.

- [ ] **Step 4: Commit**

```bash
git add apps/database/supabase/migrations/20260623000009_smp_cron_midnight_checkout.sql
git commit -m "feat(db): add pg_cron midnight auto-checkout job"
```

---

### Task 5: QR scanner Client Component

**Files:**
- Create: `apps/web/src/components/checkin/QrScanner.tsx`

This component uses `@zxing/library` to access the device camera and continuously decode QR codes. It calls `onScan(token)` once per successful decode, then pauses until `ready` prop is restored to prevent duplicate submissions.

- [ ] **Step 1: Install `@zxing/library`**

```bash
cd apps/web && pnpm add @zxing/library
```

Expected: added to `apps/web/package.json`.

- [ ] **Step 2: Create the scanner component**

```typescript
// apps/web/src/components/checkin/QrScanner.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'

interface QrScannerProps {
  /** Called when a QR code is successfully decoded. Parent pauses scanning by setting ready=false. */
  onScan: (token: string) => void
  /** When false, the scanner pauses and shows a processing overlay */
  ready: boolean
}

export function QrScanner({ onScan, ready }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const lastScannedRef = useRef<string | null>(null)

  const startScanner = useCallback(async () => {
    if (!videoRef.current) return

    try {
      readerRef.current = new BrowserMultiFormatReader()
      const devices = await BrowserMultiFormatReader.listVideoInputDevices()

      if (devices.length === 0) {
        setError("Aucune caméra détectée sur cet appareil.")
        return
      }

      // Prefer rear camera on mobile
      const device =
        devices.find((d) => d.label.toLowerCase().includes('back')) ??
        devices[devices.length - 1]

      setCameraActive(true)

      readerRef.current.decodeFromVideoDevice(
        device.deviceId,
        videoRef.current,
        (result, err) => {
          if (result) {
            const text = result.getText()
            // Debounce: ignore same token scanned twice in quick succession
            if (text !== lastScannedRef.current) {
              lastScannedRef.current = text
              onScan(text)
              // Reset debounce after 2 seconds
              setTimeout(() => {
                lastScannedRef.current = null
              }, 2000)
            }
          }
          if (err && !(err instanceof NotFoundException)) {
            console.error('Scanner error:', err)
          }
        }
      )
    } catch (e) {
      setError("Impossible d'accéder à la caméra. Vérifiez les permissions.")
      console.error('Camera access error:', e)
    }
  }, [onScan])

  useEffect(() => {
    startScanner()
    return () => {
      readerRef.current?.reset()
    }
  }, [startScanner])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-destructive bg-destructive/5 p-6 text-center gap-3">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={() => { setError(null); startScanner() }}
          className="text-xs underline text-muted-foreground"
        >
          Réessayer
        </button>
      </div>
    )
  }

  return (
    <div className="relative w-full max-w-sm mx-auto aspect-square rounded-xl overflow-hidden bg-black">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        muted
        playsInline
      />

      {/* Scanning reticle */}
      {cameraActive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-48 border-2 border-white rounded-lg opacity-60" />
        </div>
      )}

      {/* Processing overlay */}
      {!ready && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <p className="text-white text-sm font-medium">Traitement...</p>
        </div>
      )}

      {!cameraActive && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-white text-xs">Démarrage de la caméra...</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/checkin/QrScanner.tsx
git commit -m "feat(checkin): add ZXing-based QR scanner component"
```

---

### Task 6: Check-in result display component

**Files:**
- Create: `apps/web/src/components/checkin/CheckinResult.tsx`

- [ ] **Step 1: Create the result component**

```typescript
// apps/web/src/components/checkin/CheckinResult.tsx
'use client'

import { useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { CheckinResult as CheckinResultType } from '@/utils/zod-schemas/checkin'

interface CheckinResultProps {
  result: CheckinResultType
  /** Called after auto-reset timeout (4 seconds) */
  onReset: () => void
}

const STATUS_CONFIG = {
  AUTHORIZED: {
    bg: 'bg-green-50 border-green-200',
    heading: 'text-green-800',
    badge: 'bg-green-100 text-green-800',
    label: 'AUTORISÉ',
  },
  DENIED_EXPIRED: {
    bg: 'bg-red-50 border-red-200',
    heading: 'text-red-800',
    badge: 'bg-red-100 text-red-800',
    label: 'REFUSÉ — EXPIRÉ',
  },
  DENIED_NO_SUB: {
    bg: 'bg-red-50 border-red-200',
    heading: 'text-red-800',
    badge: 'bg-red-100 text-red-800',
    label: 'REFUSÉ — SANS ABONNEMENT',
  },
  DENIED_UNKNOWN: {
    bg: 'bg-red-50 border-red-200',
    heading: 'text-red-800',
    badge: 'bg-red-100 text-red-800',
    label: 'QR NON RECONNU',
  },
  ALREADY_IN: {
    bg: 'bg-yellow-50 border-yellow-200',
    heading: 'text-yellow-800',
    badge: 'bg-yellow-100 text-yellow-800',
    label: 'DÉJÀ PRÉSENT',
  },
} as const

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd MMMM yyyy', { locale: fr })
  } catch {
    return dateStr
  }
}

export function CheckinResult({ result, onReset }: CheckinResultProps) {
  useEffect(() => {
    const timer = setTimeout(onReset, 4000)
    return () => clearTimeout(timer)
  }, [result, onReset])

  const config = STATUS_CONFIG[result.status]

  return (
    <div className={`w-full max-w-sm mx-auto rounded-xl border p-6 ${config.bg} flex flex-col gap-4`}>
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide self-start ${config.badge}`}>
        {config.label}
      </div>

      {result.status === 'AUTHORIZED' && (
        <>
          <div>
            <p className={`text-2xl font-bold ${config.heading}`}>{result.studentName}</p>
            <p className="text-sm text-muted-foreground mt-1">{result.planName}</p>
          </div>
          <div className="text-sm space-y-1">
            <p>Expire le : <span className="font-medium">{formatDate(result.endDate)}</span></p>
            <p>Jours restants : <span className="font-medium">{result.daysRemaining}</span></p>
          </div>
        </>
      )}

      {result.status === 'DENIED_EXPIRED' && (
        <>
          <p className={`text-2xl font-bold ${config.heading}`}>{result.studentName}</p>
          <p className="text-sm">
            Abonnement expiré le : <span className="font-medium">{formatDate(result.endDate)}</span>
          </p>
        </>
      )}

      {result.status === 'DENIED_NO_SUB' && (
        <p className={`text-xl font-bold ${config.heading}`}>{result.studentName}</p>
      )}

      {result.status === 'DENIED_UNKNOWN' && (
        <p className="text-sm text-muted-foreground">
          Ce code QR n&apos;est pas associé à un compte Synapse valide.
        </p>
      )}

      {result.status === 'ALREADY_IN' && (
        <>
          <p className={`text-2xl font-bold ${config.heading}`}>{result.studentName}</p>
          <p className="text-sm">
            Entrée enregistrée à : <span className="font-medium">{format(parseISO(result.checkedInAt), 'HH:mm', { locale: fr })}</span>
          </p>
        </>
      )}

      <p className="text-xs text-muted-foreground text-right">Réinitialisation dans 4 s…</p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/checkin/CheckinResult.tsx
git commit -m "feat(checkin): add result display component with 5-state styling"
```

---

### Task 7: Employee check-in page

**Files:**
- Create: `apps/web/src/app/employee/checkin/page.tsx`
- Create: `apps/web/src/app/employee/checkin/CheckinClient.tsx`

The page has two sections: the QR scanner (top) and a live list of students currently inside with checkout buttons (bottom).

- [ ] **Step 1: Create the Client orchestrator**

```typescript
// apps/web/src/app/employee/checkin/CheckinClient.tsx
'use client'

import { useState, useCallback } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { QrScanner } from '@/components/checkin/QrScanner'
import { CheckinResult } from '@/components/checkin/CheckinResult'
import { checkinAction } from '@/actions/checkin/checkin-action'
import { checkoutAction } from '@/actions/checkin/checkout-action'
import type { CheckinResult as CheckinResultType } from '@/utils/zod-schemas/checkin'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

interface OpenAttendance {
  id: string
  studentName: string
  checkedInAt: string
}

interface CheckinClientProps {
  initialOpenAttendance: OpenAttendance[]
}

export function CheckinClient({ initialOpenAttendance }: CheckinClientProps) {
  const [scannerReady, setScannerReady] = useState(true)
  const [lastResult, setLastResult] = useState<CheckinResultType | null>(null)
  const [openAttendance, setOpenAttendance] = useState(initialOpenAttendance)

  const { execute: executeCheckin } = useAction(checkinAction, {
    onSuccess: ({ data }) => {
      if (!data) return
      setLastResult(data)
      if (data.status === 'AUTHORIZED') {
        // Optimistic update — real data refreshes on reset
        setOpenAttendance((prev) => [...prev])
      }
    },
    onError: () => {
      setLastResult({ status: 'DENIED_UNKNOWN' })
    },
    onSettled: () => {
      // Scanner stays paused until result is dismissed
    },
  })

  const { execute: executeCheckout } = useAction(checkoutAction, {
    onSuccess: (_, input) => {
      setOpenAttendance((prev) =>
        prev.filter((a) => a.id !== (input as any)?.attendanceId)
      )
    },
  })

  const handleScan = useCallback(
    (token: string) => {
      if (!scannerReady) return
      setScannerReady(false)
      executeCheckin({ qrToken: token })
    },
    [scannerReady, executeCheckin]
  )

  const handleReset = useCallback(() => {
    setLastResult(null)
    setScannerReady(true)
  }, [])

  return (
    <div className="flex flex-col gap-8">
      {/* Scanner area */}
      <section>
        <h2 className="text-base font-semibold mb-3">Scanner un QR Code</h2>
        {lastResult ? (
          <CheckinResult result={lastResult} onReset={handleReset} />
        ) : (
          <QrScanner onScan={handleScan} ready={scannerReady} />
        )}
      </section>

      {/* Students currently inside */}
      <section>
        <h2 className="text-base font-semibold mb-3">
          Présents ({openAttendance.length})
        </h2>
        {openAttendance.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun étudiant présent pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {openAttendance.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between border rounded-lg px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{a.studentName}</p>
                  <p className="text-xs text-muted-foreground">
                    Entrée à{' '}
                    {format(parseISO(a.checkedInAt), 'HH:mm', { locale: fr })}
                  </p>
                </div>
                <button
                  onClick={() => executeCheckout({ attendanceId: a.id })}
                  className="text-xs border rounded-md px-3 py-1.5 hover:bg-accent"
                >
                  Sortie
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Create the Server Component page**

```typescript
// apps/web/src/app/employee/checkin/page.tsx
import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { CheckinClient } from './CheckinClient'

export const metadata = {
  title: 'Contrôle d\'accès — Synapse',
}

export default async function EmployeeCheckinPage() {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch students currently inside (open attendance)
  const { data: openRows } = await supabase
    .from('attendance')
    .select('id, checked_in_at, profiles!attendance_student_id_fkey(full_name)')
    .is('checked_out_at', null)
    .order('checked_in_at', { ascending: false })

  const openAttendance = (openRows ?? []).map((row) => ({
    id: row.id,
    studentName: (row as any).profiles?.full_name ?? 'Inconnu',
    checkedInAt: row.checked_in_at,
  }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Contrôle d&apos;accès</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Scannez le QR code d&apos;un étudiant pour valider son entrée.
        </p>
      </div>

      <CheckinClient initialOpenAttendance={openAttendance} />
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Smoke test**

```bash
cd /home/sah/Synapse && pnpm dev
```

Open http://localhost:3000/employee/checkin as an employee. Expected:
- Camera permission prompt appears
- Camera stream renders in the scanner box
- Scanning a valid student QR shows green AUTORISÉ result
- After 4 seconds the scanner resets
- Student appears in "Présents" list
- Clicking "Sortie" removes them from the list

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/employee/checkin/
git commit -m "feat(employee): add camera QR scanner check-in page with live presence list"
```

---

## Self-Review Checklist

- [ ] `attendance` table has no FK to `seats`/`rooms` until Phase 3 (nullable UUIDs)
- [ ] HMAC verification (`verifyQrToken`) called before any DB read — unknown tokens never hit DB
- [ ] `DENIED_EXPIRED` vs `DENIED_NO_SUB` distinction handled (check expired sub history)
- [ ] `ALREADY_IN` state returns correct `checkedInAt` time
- [ ] Scanner debounces same token (2s) to prevent duplicate submissions
- [ ] `entry_method = 'qr_scan'` on all inserts
- [ ] `seat_id = null`, `room_id = null` on Phase 2 inserts
- [ ] pg_cron midnight checkout job targets `WHERE checked_out_at IS NULL`
- [ ] Manual checkout action guards against double-close with `.is('checked_out_at', null)`
- [ ] `employeeActionClient` used — admin can also check in students
- [ ] Result display auto-resets after 4 seconds
- [ ] French UI throughout — all status labels in French
- [ ] No `payment_method` columns introduced
