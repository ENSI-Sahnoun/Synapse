# Phase 6B: Scheduled Expiry Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement daily scheduled notification delivery for subscription expiry warnings (J-7, J-3, J-1), expiry day (J-0), and renewal reminders (J+3) via a pg_cron job calling a Next.js API route, using the channel senders built in Phase 6A.

**Architecture:** A `pg_cron` job fires daily at 09:00 Africa/Tunis (UTC+1, so 08:00 UTC) and calls `POST /api/notifications/process` with a service-role secret header. The API route queries subscriptions matching each trigger window, checks enabled channels via `notification_channel_config`, dispatches via the 6A dispatcher, and inserts an in-app `notifications` row for every student notified. Delivery errors per student are logged to console (non-fatal) — one bad phone number does not block the batch.

**Tech Stack:** pg_cron (Supabase built-in), Next.js Route Handler, Resend + Twilio + Meta WhatsApp (via 6A modules), Supabase service role client

## Global Constraints

- Depends on Phase 6A (senders, dispatcher, channel config data layer)
- Migration prefix ≥ 20260623400001
- API route must verify `x-cron-secret` header before processing — never exposed publicly
- All DB queries use the Supabase service-role client (bypasses RLS) — never the anon client
- French UI — in-app notification messages in French
- All commands run from `/home/sah/Synapse`
- `notification_type` values: `'expiry_7d' | 'expiry_3d' | 'expiry_1d' | 'expired' | 'renewal_reminder'`

---

### Task 1: Add CRON_SECRET env var

**Files:**
- `.env.local` (append — never commit)
- `apps/web/src/env.ts`

- [ ] **Step 1: Add secret to .env.local**

```bash
# Scheduled notifications cron secret (shared between pg_cron and Next.js API route)
CRON_SECRET=replace_with_a_long_random_string_at_least_32_chars
```

Generate a secure value: `openssl rand -hex 32`

- [ ] **Step 2: Add to env validation**

In `apps/web/src/env.ts`, add to server schema:

```typescript
CRON_SECRET: z.string().min(32),
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/env.ts
git commit -m "feat(notifications): add CRON_SECRET env var validation"
```

---

### Task 2: pg_cron migration

**Files:**
- Create: `apps/database/supabase/migrations/20260623400001_notification_cron_job.sql`

- [ ] **Step 1: Write migration**

```sql
-- apps/database/supabase/migrations/20260623400001_notification_cron_job.sql

-- Enable pg_cron extension (Supabase Pro has it available)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily job at 08:00 UTC (09:00 Africa/Tunis)
-- The job POSTs to the Next.js API route with the cron secret
SELECT cron.schedule(
  'synapse-daily-notifications',
  '0 8 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.base_url') || '/api/notifications/process',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', current_setting('app.cron_secret')
      ),
      body := '{}'::jsonb
    );
  $$
);
```

> **Operator note:** After applying this migration, set the two Postgres parameters:
> ```sql
> ALTER DATABASE postgres SET app.base_url = 'https://your-production-domain.com';
> ALTER DATABASE postgres SET app.cron_secret = 'your_cron_secret_value';
> ```
> These parameters are read at runtime by the cron job. Never put them in migration files.

- [ ] **Step 2: Apply migration**

```bash
pnpm supabase db push --db-url "$DATABASE_URL"
```

Expected: Migration applied. `SELECT * FROM cron.job;` should show `synapse-daily-notifications`.

- [ ] **Step 3: Verify job registered**

```bash
pnpm supabase db execute --db-url "$DATABASE_URL" \
  --command "SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'synapse-daily-notifications';"
```

Expected: 1 row with schedule `0 8 * * *`.

- [ ] **Step 4: Commit**

```bash
git add apps/database/supabase/migrations/20260623400001_notification_cron_job.sql
git commit -m "feat(db): add pg_cron daily notification job at 08:00 UTC"
```

---

### Task 3: Subscription query helpers for notification triggers

**Files:**
- Create: `apps/web/src/data/notifications/expiry-queries.ts`
- Create: `apps/web/src/data/notifications/expiry-queries.test.ts`

- [ ] **Step 1: Write query helpers**

```typescript
// apps/web/src/data/notifications/expiry-queries.ts
'use server'

import { createAdminClient } from '@/supabase-clients/server'
// Note: createAdminClient uses the service role key — bypasses RLS

export interface StudentSubscriptionRow {
  subscription_id: string
  student_id: string
  student_name: string
  student_email: string | null
  student_phone: string | null
  plan_name: string
  end_date: string   // ISO date string yyyy-MM-dd
  days_remaining: number  // can be negative for expired
}

/**
 * Returns students whose subscription end_date is exactly `daysFromToday` days from today.
 * daysFromToday = 7 → expiry_7d, 3 → expiry_3d, 1 → expiry_1d, 0 → expired, -3 → renewal_reminder
 */
export async function getSubscriptionsByExpiryOffset(
  daysFromToday: number,
): Promise<StudentSubscriptionRow[]> {
  const supabase = createAdminClient()
  const targetDate = new Date()
  targetDate.setDate(targetDate.getDate() + daysFromToday)
  const targetDateStr = targetDate.toISOString().split('T')[0]  // yyyy-MM-dd

  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      id,
      end_date,
      plan_id,
      student_id,
      subscription_plans!inner ( name ),
      profiles!inner ( full_name, email:auth_email, phone )
    `)
    .eq('end_date', targetDateStr)

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    subscription_id: row.id,
    student_id: row.student_id,
    student_name: row.profiles.full_name,
    student_email: row.profiles.email ?? null,
    student_phone: row.profiles.phone ?? null,
    plan_name: row.subscription_plans.name,
    end_date: row.end_date,
    days_remaining: daysFromToday,
  }))
}
```

> **Note on profiles.email:** `profiles` does not store email — it comes from `auth.users`. If the join does not expose it directly, use a Postgres view or query `auth.users` via the admin client. Adjust the select if needed:

```typescript
// Alternative if email not on profiles join:
// After fetching subscriptions, collect student_ids and call:
const { data: users } = await supabase.auth.admin.listUsers()
// Then map user.email by user.id
```

- [ ] **Step 2: Write type-only test (no DB needed)**

```typescript
// apps/web/src/data/notifications/expiry-queries.test.ts
import { describe, it, expect } from 'vitest'

// Pure date-offset logic extracted for unit testing
function getTargetDate(daysFromToday: number): string {
  const d = new Date('2026-06-23')
  d.setDate(d.getDate() + daysFromToday)
  return d.toISOString().split('T')[0]
}

describe('expiry offset date calculation', () => {
  it('J-7 offset gives correct date', () => {
    expect(getTargetDate(7)).toBe('2026-06-30')
  })

  it('J-3 offset gives correct date', () => {
    expect(getTargetDate(3)).toBe('2026-06-26')
  })

  it('J-0 gives today', () => {
    expect(getTargetDate(0)).toBe('2026-06-23')
  })

  it('J+3 (renewal reminder) gives future date', () => {
    expect(getTargetDate(-3)).toBe('2026-06-20')
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd apps/web && pnpm test -- --reporter=verbose expiry-queries.test
```

Expected: 4 passing.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/data/notifications/expiry-queries.ts \
        apps/web/src/data/notifications/expiry-queries.test.ts
git commit -m "feat(notifications): add subscription expiry query helpers"
```

---

### Task 4: In-app notification insert helper

**Files:**
- Create: `apps/web/src/data/notifications/inapp.ts`

- [ ] **Step 1: Write helper**

```typescript
// apps/web/src/data/notifications/inapp.ts
'use server'

import { createAdminClient } from '@/supabase-clients/server'
import type { NotificationType } from '@/data/admin/notification-channel-config'

export async function insertInAppNotification(opts: {
  userId: string
  type: NotificationType
  message: string
}): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('notifications').insert({
    user_id: opts.userId,
    type: opts.type,
    message: opts.message,
  })
  if (error) throw error
}

export function buildExpiryWarningMessage(opts: {
  planName: string
  daysLeft: number
  expiryDate: string
}): string {
  return `Votre abonnement "${opts.planName}" expire dans ${opts.daysLeft} jour(s) (le ${opts.expiryDate}).`
}

export function buildExpiredMessage(opts: { planName: string; expiryDate: string }): string {
  return `Votre abonnement "${opts.planName}" a expiré le ${opts.expiryDate}. Rendez-vous à Synapse pour le renouveler.`
}

export function buildRenewalReminderMessage(opts: { planName: string; expiryDate: string }): string {
  return `Rappel : votre abonnement "${opts.planName}" a expiré le ${opts.expiryDate}. Revenez nous voir !`
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/data/notifications/inapp.ts
git commit -m "feat(notifications): add in-app notification insert helper with French templates"
```

---

### Task 5: API route /api/notifications/process

**Files:**
- Create: `apps/web/src/app/api/notifications/process/route.ts`

- [ ] **Step 1: Write route handler**

```typescript
// apps/web/src/app/api/notifications/process/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSubscriptionsByExpiryOffset } from '@/data/notifications/expiry-queries'
import { getEnabledChannels, type NotificationType } from '@/data/admin/notification-channel-config'
import { dispatch } from '@/lib/notifications/dispatcher'
import { insertInAppNotification, buildExpiryWarningMessage, buildExpiredMessage, buildRenewalReminderMessage } from '@/data/notifications/inapp'
import {
  buildExpiryWarningEmail,
  buildExpiredEmail,
  buildRenewalReminderEmail,
} from '@/lib/notifications/email'
import {
  buildExpiryWarningSms,
  buildExpiredSms,
} from '@/lib/notifications/sms'
import {
  buildExpiryWarningWhatsApp,
  buildExpiredWhatsApp,
  buildRenewalReminderWhatsApp,
} from '@/lib/notifications/whatsapp'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

function formatDate(isoDate: string): string {
  return format(new Date(isoDate), 'dd/MM/yyyy', { locale: fr })
}

interface TriggerConfig {
  daysOffset: number
  notificationType: NotificationType
}

const TRIGGERS: TriggerConfig[] = [
  { daysOffset: 7,  notificationType: 'expiry_7d' },
  { daysOffset: 3,  notificationType: 'expiry_3d' },
  { daysOffset: 1,  notificationType: 'expiry_1d' },
  { daysOffset: 0,  notificationType: 'expired' },
  { daysOffset: -3, notificationType: 'renewal_reminder' },
]

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify cron secret
  const secret = request.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const report: Record<string, { processed: number; errors: string[] }> = {}

  for (const trigger of TRIGGERS) {
    const { daysOffset, notificationType } = trigger
    report[notificationType] = { processed: 0, errors: [] }

    try {
      const students = await getSubscriptionsByExpiryOffset(daysOffset)
      const channels = await getEnabledChannels(notificationType)

      for (const student of students) {
        try {
          const formattedDate = formatDate(student.end_date)
          const daysAbs = Math.abs(daysOffset)

          // Build messages
          let emailSubject = ''
          let emailHtml = ''
          let smsBody = ''
          let whatsappBody = ''
          let inAppMessage = ''

          if (notificationType === 'expired') {
            const emailMsg = buildExpiredEmail({ studentName: student.student_name, planName: student.plan_name, expiryDate: formattedDate })
            emailSubject = emailMsg.subject
            emailHtml = emailMsg.html
            smsBody = buildExpiredSms({ studentName: student.student_name, expiryDate: formattedDate }).body
            whatsappBody = buildExpiredWhatsApp({ studentName: student.student_name, planName: student.plan_name, expiryDate: formattedDate }).body
            inAppMessage = buildExpiredMessage({ planName: student.plan_name, expiryDate: formattedDate })
          } else if (notificationType === 'renewal_reminder') {
            const emailMsg = buildRenewalReminderEmail({ studentName: student.student_name, planName: student.plan_name, expiryDate: formattedDate })
            emailSubject = emailMsg.subject
            emailHtml = emailMsg.html
            smsBody = buildExpiredSms({ studentName: student.student_name, expiryDate: formattedDate }).body
            whatsappBody = buildRenewalReminderWhatsApp({ studentName: student.student_name, planName: student.plan_name, expiryDate: formattedDate }).body
            inAppMessage = buildRenewalReminderMessage({ planName: student.plan_name, expiryDate: formattedDate })
          } else {
            // expiry_7d, expiry_3d, expiry_1d
            const emailMsg = buildExpiryWarningEmail({ studentName: student.student_name, planName: student.plan_name, expiryDate: formattedDate, daysLeft: daysOffset })
            emailSubject = emailMsg.subject
            emailHtml = emailMsg.html
            smsBody = buildExpiryWarningSms({ studentName: student.student_name, expiryDate: formattedDate, daysLeft: daysOffset }).body
            whatsappBody = buildExpiryWarningWhatsApp({ studentName: student.student_name, planName: student.plan_name, expiryDate: formattedDate, daysLeft: daysOffset }).body
            inAppMessage = buildExpiryWarningMessage({ planName: student.plan_name, daysLeft: daysOffset, expiryDate: formattedDate })
          }

          // Always insert in-app notification
          await insertInAppNotification({
            userId: student.student_id,
            type: notificationType,
            message: inAppMessage,
          })

          // Dispatch to external channels
          const externalChannels = channels.filter((c) => c !== 'inapp')
          if (externalChannels.length > 0) {
            const results = await dispatch(
              externalChannels,
              { email: student.student_email ?? undefined, phone: student.student_phone ?? undefined },
              { emailSubject, emailHtml, smsBody, whatsappBody },
            )
            results.forEach(({ channel, error }) => {
              if (error) {
                report[notificationType].errors.push(
                  `student=${student.student_id} channel=${channel}: ${error}`,
                )
                console.error(`[notifications] ${notificationType} ${channel} failed for ${student.student_id}: ${error}`)
              }
            })
          }

          report[notificationType].processed++
        } catch (studentErr) {
          const msg = studentErr instanceof Error ? studentErr.message : String(studentErr)
          report[notificationType].errors.push(`student=${student.student_id}: ${msg}`)
          console.error(`[notifications] failed for student ${student.student_id}:`, studentErr)
        }
      }
    } catch (triggerErr) {
      const msg = triggerErr instanceof Error ? triggerErr.message : String(triggerErr)
      report[notificationType].errors.push(`trigger_error: ${msg}`)
      console.error(`[notifications] trigger ${notificationType} failed:`, triggerErr)
    }
  }

  return NextResponse.json({ ok: true, report })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/notifications/process/route.ts
git commit -m "feat(notifications): add /api/notifications/process route handler"
```

---

### Task 6: Manual trigger UI for admin (test button)

**Files:**
- Create: `apps/web/src/app/(admin-pages)/admin/notifications/trigger/page.tsx`

- [ ] **Step 1: Write trigger page**

```tsx
// apps/web/src/app/(admin-pages)/admin/notifications/trigger/page.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function NotificationTriggerPage() {
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleTrigger() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/notifications/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': process.env.NEXT_PUBLIC_CRON_SECRET_DEBUG ?? '',
        },
      })
      const json = await res.json()
      setResult(JSON.stringify(json, null, 2))
    } catch (err) {
      setResult(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Déclencher les notifications manuellement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cette action déclenche immédiatement le traitement des notifications planifiées
            (expirations J-7, J-3, J-1, J-0, J+3). En production, ce traitement s'exécute
            automatiquement chaque jour à 9h00.
          </p>
          <Button onClick={handleTrigger} disabled={loading}>
            {loading ? 'Traitement en cours...' : 'Lancer maintenant'}
          </Button>
          {result && (
            <pre className="bg-muted rounded p-4 text-xs overflow-auto max-h-96">{result}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

> **Note:** For the admin manual trigger to work in development, set `NEXT_PUBLIC_CRON_SECRET_DEBUG` in `.env.local` to the same value as `CRON_SECRET`. Remove this page or restrict it behind additional auth in production.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/(admin-pages)/admin/notifications/trigger/page.tsx
git commit -m "feat(admin): add manual notification trigger page for testing"
```

---

## Self-Review

- [ ] API route returns 401 for missing or wrong `x-cron-secret`
- [ ] All 5 trigger types covered: expiry_7d, expiry_3d, expiry_1d, expired, renewal_reminder
- [ ] In-app notification always inserted regardless of external channel config
- [ ] Per-student errors do not abort the batch — logged to console only
- [ ] Per-trigger errors do not abort other triggers
- [ ] `getSubscriptionsByExpiryOffset` uses service-role client (bypasses RLS)
- [ ] pg_cron job schedule is `0 8 * * *` (08:00 UTC = 09:00 Africa/Tunis)
- [ ] `app.base_url` and `app.cron_secret` set via `ALTER DATABASE` — not in migration SQL
- [ ] 4 unit tests passing for date offset logic
