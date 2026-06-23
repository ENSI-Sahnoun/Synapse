# Phase 2A: QR Token Migration to HMAC + Student QR Display

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the random `qr_token` placeholder with a cryptographically signed HMAC token and display it as a scannable QR code in the student PWA at `/student/qr`.

**Architecture:** A new migration backfills existing `profiles.qr_token` values using a Postgres `hmac()` call for symmetry, but the canonical source of truth for new tokens is a Next.js server action that calls Node's built-in `crypto.createHmac`. A dedicated `generateQrToken(studentId)` utility function is used by both the new-user trigger path (via a server action) and the backfill script. The student QR page is a Server Component that reads the token and renders a `<QrCodeImage>` Client Component using the `qrcode` library.

**Tech Stack:** Node.js `crypto` (built-in), `qrcode` npm package, Next.js 16 Server Components, Supabase admin client

## Global Constraints

- `QR_HMAC_SECRET` env var must be set — server-side only, never exposed to client
- Token format exactly: `SYNAPSE-{student_id}-{hex(hmac_sha256(student_id, QR_HMAC_SECRET))}`
- `qr_token` remains stored in `profiles` — no runtime recomputation on scan
- Student can only view their own QR — RLS enforces this
- No `payment_method` columns anywhere
- French UI
- Migration timestamps: after `20260623000005`
- All commands run from `/home/sah/Synapse`

---

### Task 1: Add `QR_HMAC_SECRET` environment variable

**Files:**
- Modify: `apps/web/.env.local` (developer adds manually — documented here)
- Modify: `apps/web/src/env.ts` (add server-side validation if file exists, else document)

- [ ] **Step 1: Add secret to local env**

Open `apps/web/.env.local` and add:

```bash
# QR token signing key — server-side only
QR_HMAC_SECRET=change-me-to-a-random-64-char-hex-string
```

Generate a strong value:

```bash
openssl rand -hex 32
```

Copy the output and replace `change-me-to-a-random-64-char-hex-string` with it.

- [ ] **Step 2: Verify the variable is accessible in server context**

```bash
cd apps/web && node -e "require('dotenv').config({ path: '.env.local' }); console.log(process.env.QR_HMAC_SECRET ? 'OK' : 'MISSING')"
```

Expected output: `OK`

- [ ] **Step 3: Commit env template (not the secret)**

Add a `.env.example` entry so future developers know the variable is required:

```bash
# In apps/web/.env.example (create if missing):
echo "QR_HMAC_SECRET=your-random-64-char-hex-string" >> apps/web/.env.example
```

```bash
git add apps/web/.env.example
git commit -m "chore(env): document QR_HMAC_SECRET requirement"
```

---

### Task 2: HMAC token utility

**Files:**
- Create: `apps/web/src/lib/qr-token.ts`
- Create: `apps/web/src/lib/qr-token.test.ts`

- [ ] **Step 1: Write the utility**

```typescript
// apps/web/src/lib/qr-token.ts
import 'server-only'
import { createHmac } from 'crypto'

/**
 * Generates a QR token for a student.
 * Format: SYNAPSE-{studentId}-{hex(hmac_sha256(studentId, QR_HMAC_SECRET))}
 *
 * The token is stored in profiles.qr_token and validated on every check-in.
 * The HMAC prevents token forgery — scanning an arbitrary UUID won't work.
 */
export function generateQrToken(studentId: string): string {
  const secret = process.env.QR_HMAC_SECRET
  if (!secret) {
    throw new Error('QR_HMAC_SECRET is not set')
  }
  const hmac = createHmac('sha256', secret).update(studentId).digest('hex')
  return `SYNAPSE-${studentId}-${hmac}`
}

/**
 * Verifies a scanned QR token string.
 * Returns the studentId if valid, or null if the HMAC doesn't match.
 */
export function verifyQrToken(token: string): string | null {
  const secret = process.env.QR_HMAC_SECRET
  if (!secret) {
    throw new Error('QR_HMAC_SECRET is not set')
  }
  // Format: SYNAPSE-{uuid}-{64-char hex}
  const prefix = 'SYNAPSE-'
  if (!token.startsWith(prefix)) return null

  // uuid is 36 chars, then '-', then 64-char hex
  const rest = token.slice(prefix.length) // "{uuid}-{hex}"
  const uuidLength = 36
  if (rest.length < uuidLength + 1 + 64) return null

  const studentId = rest.slice(0, uuidLength)
  const providedHmac = rest.slice(uuidLength + 1)

  const expectedHmac = createHmac('sha256', secret).update(studentId).digest('hex')

  // Constant-time comparison to prevent timing attacks
  if (providedHmac.length !== expectedHmac.length) return null
  let diff = 0
  for (let i = 0; i < expectedHmac.length; i++) {
    diff |= providedHmac.charCodeAt(i) ^ expectedHmac.charCodeAt(i)
  }
  return diff === 0 ? studentId : null
}
```

- [ ] **Step 2: Write tests**

```typescript
// apps/web/src/lib/qr-token.test.ts
import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.QR_HMAC_SECRET = 'test-secret-key-for-unit-tests-only'
})

// Dynamic import required because the module is 'server-only'
describe('generateQrToken', () => {
  it('returns a token with correct prefix', async () => {
    const { generateQrToken } = await import('./qr-token')
    const studentId = '550e8400-e29b-41d4-a716-446655440000'
    const token = generateQrToken(studentId)
    expect(token).toMatch(/^SYNAPSE-550e8400-e29b-41d4-a716-446655440000-[a-f0-9]{64}$/)
  })

  it('is deterministic for same input', async () => {
    const { generateQrToken } = await import('./qr-token')
    const studentId = '550e8400-e29b-41d4-a716-446655440000'
    expect(generateQrToken(studentId)).toBe(generateQrToken(studentId))
  })

  it('produces different tokens for different student IDs', async () => {
    const { generateQrToken } = await import('./qr-token')
    const t1 = generateQrToken('550e8400-e29b-41d4-a716-446655440000')
    const t2 = generateQrToken('660e8400-e29b-41d4-a716-446655440001')
    expect(t1).not.toBe(t2)
  })
})

describe('verifyQrToken', () => {
  it('returns studentId for valid token', async () => {
    const { generateQrToken, verifyQrToken } = await import('./qr-token')
    const studentId = '550e8400-e29b-41d4-a716-446655440000'
    const token = generateQrToken(studentId)
    expect(verifyQrToken(token)).toBe(studentId)
  })

  it('returns null for tampered token', async () => {
    const { verifyQrToken } = await import('./qr-token')
    const tampered = 'SYNAPSE-550e8400-e29b-41d4-a716-446655440000-' + 'a'.repeat(64)
    expect(verifyQrToken(tampered)).toBeNull()
  })

  it('returns null for invalid prefix', async () => {
    const { verifyQrToken } = await import('./qr-token')
    expect(verifyQrToken('INVALID-TOKEN')).toBeNull()
  })

  it('returns null for empty string', async () => {
    const { verifyQrToken } = await import('./qr-token')
    expect(verifyQrToken('')).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests (they should fail — module not implemented yet if running TDD, or pass now)**

```bash
cd apps/web && pnpm test -- --reporter=verbose qr-token.test 2>&1 | tail -20
```

Expected output: all 6 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/qr-token.ts apps/web/src/lib/qr-token.test.ts
git commit -m "feat(qr): add HMAC QR token generation and verification utility"
```

---

### Task 3: Migration — backfill existing profiles with HMAC tokens

**Files:**
- Create: `apps/database/supabase/migrations/20260623000006_smp_qr_token_hmac.sql`
- Create: `apps/web/src/scripts/backfill-qr-tokens.ts`

- [ ] **Step 1: Write the SQL migration**

The migration itself cannot call `QR_HMAC_SECRET` (it's an app secret, not a DB secret). Instead:
1. The migration adds a constraint ensuring `qr_token` matches the new format.
2. The actual backfill runs as a Node.js script after migration.

```sql
-- apps/database/supabase/migrations/20260623000006_smp_qr_token_hmac.sql

-- Add a check constraint enforcing the new HMAC token format
-- Format: SYNAPSE-{uuid}-{64 hex chars}
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_qr_token_format
  CHECK (
    qr_token IS NULL
    OR qr_token ~ '^SYNAPSE-[0-9a-f-]{36}-[0-9a-f]{64}$'
  );

-- Drop the constraint temporarily to allow backfill (re-added after)
-- The backfill script apps/web/src/scripts/backfill-qr-tokens.ts must run
-- before this migration is applied to production with the constraint active.
-- For local dev: run 'db reset' which re-seeds clean data from handle_new_user
-- (Phase 1A), then the backfill script updates all tokens.
COMMENT ON COLUMN public.profiles.qr_token IS
  'HMAC-signed QR token. Format: SYNAPSE-{student_id}-{hmac_sha256(student_id, QR_HMAC_SECRET)}. Backfill via apps/web/src/scripts/backfill-qr-tokens.ts';
```

- [ ] **Step 2: Write the backfill script**

```typescript
// apps/web/src/scripts/backfill-qr-tokens.ts
/**
 * Backfill script: regenerate all student profiles.qr_token values using HMAC.
 *
 * Usage:
 *   QR_HMAC_SECRET=<secret> SUPABASE_SERVICE_ROLE_KEY=<key> \
 *     NEXT_PUBLIC_SUPABASE_URL=<url> \
 *     npx tsx apps/web/src/scripts/backfill-qr-tokens.ts
 *
 * Safe to run multiple times — idempotent (same input always produces same token).
 */
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const secret = process.env.QR_HMAC_SECRET

if (!url || !serviceKey || !secret) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, QR_HMAC_SECRET')
  process.exit(1)
}

function generateToken(studentId: string): string {
  const hmac = createHmac('sha256', secret!).update(studentId).digest('hex')
  return `SYNAPSE-${studentId}-${hmac}`
}

const supabase = createClient(url, serviceKey)

async function main() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'student')

  if (error) {
    console.error('Failed to fetch profiles:', error.message)
    process.exit(1)
  }

  console.log(`Found ${profiles.length} student profiles to backfill.`)

  let updated = 0
  let failed = 0

  for (const profile of profiles) {
    const newToken = generateToken(profile.id)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ qr_token: newToken })
      .eq('id', profile.id)

    if (updateError) {
      console.error(`Failed to update profile ${profile.id}:`, updateError.message)
      failed++
    } else {
      updated++
    }
  }

  console.log(`Done. Updated: ${updated}, Failed: ${failed}`)
  if (failed > 0) process.exit(1)
}

main()
```

- [ ] **Step 3: Apply migration locally**

```bash
cd apps/database && pnpm supabase db reset
```

Expected: migration applies without error. (Existing rows have old random tokens which don't match the new constraint yet — the constraint allows `IS NULL` or matching rows. Old-format tokens like `SYNAPSE-hexhex` won't match — this is fine since `db reset` recreates from scratch and the trigger creates rows with old-format tokens. Run the backfill next.)

- [ ] **Step 4: Run backfill locally**

```bash
source apps/web/.env.local && \
  SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY apps/web/.env.local | cut -d= -f2) \
  npx tsx apps/web/src/scripts/backfill-qr-tokens.ts
```

Expected output:
```
Found N student profiles to backfill.
Done. Updated: N, Failed: 0
```

- [ ] **Step 5: Verify format in DB**

```bash
cd apps/database && pnpm supabase db diff --use-migra
```

Expected: empty diff.

```bash
cd apps/database && pnpm supabase db execute --sql \
  "SELECT id, substring(qr_token, 1, 50) as token_preview FROM profiles WHERE role = 'student' LIMIT 3;"
```

Each row should show `SYNAPSE-{uuid}-...`.

- [ ] **Step 6: Update `handle_new_user` trigger to generate HMAC token**

The existing `handle_new_user` trigger (from Phase 1A migration) generates `qr_token` using `gen_random_bytes`. This must now call the app-side token format. Since the DB cannot access `QR_HMAC_SECRET`, the approach is:

1. Trigger sets `qr_token = NULL` on insert (or keeps the placeholder).
2. After `supabase.auth.signUp()` in the student signup action, a server action immediately calls `updateQrToken(userId)`.

Create a new migration to update the trigger:

```sql
-- apps/database/supabase/migrations/20260623000007_smp_handle_new_user_no_qr.sql

-- The trigger no longer generates qr_token — the app generates it via HMAC.
-- After user creation the app calls the updateQrToken server action.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, university, study_level, qr_token)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'university',
    NEW.raw_user_meta_data->>'study_level',
    NULL  -- App sets qr_token after creation via HMAC
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
```

- [ ] **Step 7: Apply second migration**

```bash
cd apps/database && pnpm supabase migration up
```

Expected: migration applied.

- [ ] **Step 8: Commit**

```bash
git add apps/database/supabase/migrations/20260623000006_smp_qr_token_hmac.sql \
        apps/database/supabase/migrations/20260623000007_smp_handle_new_user_no_qr.sql \
        apps/web/src/scripts/backfill-qr-tokens.ts
git commit -m "feat(qr): add HMAC token format constraint + backfill script + trigger update"
```

---

### Task 4: Server action — assign QR token after user creation

**Files:**
- Create: `apps/web/src/actions/student/assign-qr-token.ts`

This action is called server-side immediately after `supabase.auth.admin.createUser()` (employee creates student) or after `supabase.auth.signUp()` (self-signup), using the admin client to bypass RLS.

- [ ] **Step 1: Create the action**

```typescript
// apps/web/src/actions/student/assign-qr-token.ts
'use server'

import { createAdminClient } from '@/supabase-clients/admin'
import { generateQrToken } from '@/lib/qr-token'

/**
 * Assigns an HMAC QR token to a student profile.
 * Uses the admin client to bypass RLS — must only be called from trusted server contexts.
 * Safe to call multiple times (idempotent — same student always gets same token).
 */
export async function assignQrToken(studentId: string): Promise<void> {
  const token = generateQrToken(studentId)
  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('profiles')
    .update({ qr_token: token })
    .eq('id', studentId)

  if (error) {
    throw new Error(`Impossible d'assigner le token QR: ${error.message}`)
  }
}
```

- [ ] **Step 2: Wire into student signup action**

In `apps/web/src/actions/auth/student-signup.ts` (created in Phase 1E), find the line after the user is created and add:

```typescript
// After successful supabase.auth.signUp() call, add:
import { assignQrToken } from '@/actions/student/assign-qr-token'

// Inside the action handler, after user creation:
if (data.user) {
  await assignQrToken(data.user.id)
}
```

The full relevant section should look like:

```typescript
const { data, error } = await supabase.auth.signUp({
  email: parsedInput.email,
  password: parsedInput.password,
  options: {
    data: {
      full_name: parsedInput.full_name,
      phone: parsedInput.phone ?? '',
      university: parsedInput.university ?? '',
      study_level: parsedInput.study_level ?? '',
    },
  },
})

if (error) {
  return { error: error.message }
}

// Assign HMAC QR token immediately after user creation
if (data.user) {
  await assignQrToken(data.user.id)
}

return { success: true }
```

- [ ] **Step 3: Wire into employee "create student" action**

In `apps/web/src/actions/student/create-student.ts` (Phase 1C), after `createAdminClient().auth.admin.createUser(...)`, add:

```typescript
import { assignQrToken } from '@/actions/student/assign-qr-token'

// After successful user creation:
if (createdUser.user) {
  await assignQrToken(createdUser.user.id)
}
```

- [ ] **Step 4: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/actions/student/assign-qr-token.ts \
        apps/web/src/actions/auth/student-signup.ts \
        apps/web/src/actions/student/create-student.ts
git commit -m "feat(qr): assign HMAC QR token on student creation"
```

---

### Task 5: Student QR display page

**Files:**
- Create: `apps/web/src/app/student/qr/page.tsx`
- Create: `apps/web/src/components/student/QrCodeImage.tsx`

The page is a Server Component that fetches `qr_token` from the database and passes it to the `QrCodeImage` Client Component. Generation of the PNG happens client-side using `qrcode` to avoid shipping large buffers through RSC.

- [ ] **Step 1: Install `qrcode` package**

```bash
cd apps/web && pnpm add qrcode && pnpm add -D @types/qrcode
```

Expected: packages added to `apps/web/package.json`.

- [ ] **Step 2: Create `QrCodeImage` Client Component**

```typescript
// apps/web/src/components/student/QrCodeImage.tsx
'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

interface QrCodeImageProps {
  token: string
  /** Size in pixels — default 280 */
  size?: number
}

export function QrCodeImage({ token, size = 280 }: QrCodeImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, token, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
  }, [token, size])

  return (
    <canvas
      ref={canvasRef}
      className="rounded-xl shadow-md"
      aria-label="Code QR Synapse"
    />
  )
}
```

- [ ] **Step 3: Create the QR page**

```typescript
// apps/web/src/app/student/qr/page.tsx
import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { QrCodeImage } from '@/components/student/QrCodeImage'

export const metadata = {
  title: 'Mon QR Code — Synapse',
}

export default async function StudentQrPage() {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, qr_token')
    .eq('id', user.id)
    .single()

  if (error || !profile) redirect('/login')

  if (!profile.qr_token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <p className="text-destructive text-sm">
          Votre code QR n&apos;est pas encore disponible.
        </p>
        <p className="text-muted-foreground text-xs">
          Contactez l&apos;accueil pour l&apos;activer.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Mon QR Code</h1>
        <p className="text-sm text-muted-foreground mt-1">{profile.full_name}</p>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-lg">
        <QrCodeImage token={profile.qr_token} size={260} />
      </div>

      <p className="text-xs text-muted-foreground text-center max-w-xs">
        Présentez ce code à l&apos;employé ou devant le kiosque à l&apos;entrée.
      </p>

      {/* Fullscreen button for easier scanning */}
      <button
        onClick={() => {
          const el = document.documentElement
          if (el.requestFullscreen) el.requestFullscreen()
        }}
        className="text-xs underline text-muted-foreground"
      >
        Plein écran
      </button>
    </div>
  )
}
```

Note: The fullscreen button is inline `onClick` in a Server Component — move it to a small Client Component:

Replace the `<button>` block with a Client Component:

```typescript
// apps/web/src/components/student/FullscreenButton.tsx
'use client'

export function FullscreenButton() {
  return (
    <button
      onClick={() => {
        const el = document.documentElement
        if (el.requestFullscreen) el.requestFullscreen()
      }}
      className="text-xs underline text-muted-foreground"
    >
      Plein écran
    </button>
  )
}
```

Update the QR page to import and use `FullscreenButton`:

```typescript
// apps/web/src/app/student/qr/page.tsx (final version)
import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { QrCodeImage } from '@/components/student/QrCodeImage'
import { FullscreenButton } from '@/components/student/FullscreenButton'

export const metadata = {
  title: 'Mon QR Code — Synapse',
}

export default async function StudentQrPage() {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, qr_token')
    .eq('id', user.id)
    .single()

  if (error || !profile) redirect('/login')

  if (!profile.qr_token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <p className="text-destructive text-sm">
          Votre code QR n&apos;est pas encore disponible.
        </p>
        <p className="text-muted-foreground text-xs">
          Contactez l&apos;accueil pour l&apos;activer.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Mon QR Code</h1>
        <p className="text-sm text-muted-foreground mt-1">{profile.full_name}</p>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-lg">
        <QrCodeImage token={profile.qr_token} size={260} />
      </div>

      <p className="text-xs text-muted-foreground text-center max-w-xs">
        Présentez ce code à l&apos;employé ou devant le kiosque à l&apos;entrée.
      </p>

      <FullscreenButton />
    </div>
  )
}
```

- [ ] **Step 4: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Verify page renders**

```bash
cd /home/sah/Synapse && pnpm dev
```

Open http://localhost:3000/student/qr as a logged-in student. Expected: QR code canvas renders with the student's name below the heading.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/student/qr/ \
        apps/web/src/components/student/QrCodeImage.tsx \
        apps/web/src/components/student/FullscreenButton.tsx
git commit -m "feat(student): add QR code display page with HMAC token"
```

---

### Task 6: Printable QR from employee view

**Files:**
- Create: `apps/web/src/app/employee/students/[studentId]/print-qr/page.tsx`

Employees need a print-friendly QR page for making physical cards.

- [ ] **Step 1: Create the print page**

```typescript
// apps/web/src/app/employee/students/[studentId]/print-qr/page.tsx
import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { QrCodeImage } from '@/components/student/QrCodeImage'

interface PrintQrPageProps {
  params: Promise<{ studentId: string }>
}

export default async function PrintQrPage({ params }: PrintQrPageProps) {
  const { studentId } = await params
  const supabase = await createSupabaseClient()

  const { data: viewer } = await supabase.auth.getUser()
  if (!viewer.user) redirect('/login')

  const { data: viewerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', viewer.user.id)
    .single()

  if (!viewerProfile || !['admin', 'employee'].includes(viewerProfile.role)) {
    redirect('/login')
  }

  const { data: student } = await supabase
    .from('profiles')
    .select('full_name, qr_token')
    .eq('id', studentId)
    .eq('role', 'student')
    .single()

  if (!student || !student.qr_token) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">Étudiant introuvable ou token QR non disponible.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 print:gap-4">
      <style>{`@media print { button { display: none; } }`}</style>

      <div className="text-center">
        <p className="text-lg font-semibold">{student.full_name}</p>
        <p className="text-xs text-muted-foreground">Carte d&apos;accès Synapse</p>
      </div>

      <div className="bg-white p-4 border rounded-xl shadow">
        <QrCodeImage token={student.qr_token} size={220} />
      </div>

      <button
        onClick={() => window.print()}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
      >
        Imprimer
      </button>
    </div>
  )
}
```

Note: `onClick` on a button in a Server Component is invalid. Extract it:

```typescript
// apps/web/src/components/employee/PrintButton.tsx
'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm print:hidden"
    >
      Imprimer
    </button>
  )
}
```

Update the print page to remove inline `onClick` and the `<style>` tag (use CSS class `print:hidden` instead), and import `PrintButton`:

```typescript
// apps/web/src/app/employee/students/[studentId]/print-qr/page.tsx (final)
import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { QrCodeImage } from '@/components/student/QrCodeImage'
import { PrintButton } from '@/components/employee/PrintButton'

interface PrintQrPageProps {
  params: Promise<{ studentId: string }>
}

export default async function PrintQrPage({ params }: PrintQrPageProps) {
  const { studentId } = await params
  const supabase = await createSupabaseClient()

  const { data: viewer } = await supabase.auth.getUser()
  if (!viewer.user) redirect('/login')

  const { data: viewerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', viewer.user.id)
    .single()

  if (!viewerProfile || !['admin', 'employee'].includes(viewerProfile.role)) {
    redirect('/login')
  }

  const { data: student } = await supabase
    .from('profiles')
    .select('full_name, qr_token')
    .eq('id', studentId)
    .eq('role', 'student')
    .single()

  if (!student || !student.qr_token) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">Étudiant introuvable ou token QR non disponible.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6">
      <div className="text-center">
        <p className="text-lg font-semibold">{student.full_name}</p>
        <p className="text-xs text-muted-foreground">Carte d&apos;accès Synapse</p>
      </div>

      <div className="bg-white p-4 border rounded-xl shadow">
        <QrCodeImage token={student.qr_token} size={220} />
      </div>

      <PrintButton />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Regenerate DB types**

```bash
cd /home/sah/Synapse && pnpm gen-types-local
```

Expected: `apps/web/src/lib/database.types.ts` updated.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/employee/students/ \
        apps/web/src/components/employee/PrintButton.tsx \
        apps/web/src/lib/database.types.ts
git commit -m "feat(employee): add printable QR page for student cards"
```

---

## Self-Review Checklist

- [ ] `generateQrToken` produces `SYNAPSE-{uuid}-{64-hex}` format — matches spec section 4
- [ ] `verifyQrToken` uses constant-time comparison — timing attack safe
- [ ] `QR_HMAC_SECRET` is server-only (`server-only` import in `qr-token.ts`)
- [ ] Backfill script is idempotent (same ID always same token)
- [ ] `handle_new_user` trigger no longer generates `qr_token` — app assigns it
- [ ] `assignQrToken` called in both signup flows (self-signup + employee creates student)
- [ ] Student QR page shows error state when `qr_token` is NULL
- [ ] Printable QR requires employee/admin role — students cannot access other students' QR
- [ ] No `payment_method` columns introduced
- [ ] French UI throughout
- [ ] All migrations timestamped after `20260623000005`
