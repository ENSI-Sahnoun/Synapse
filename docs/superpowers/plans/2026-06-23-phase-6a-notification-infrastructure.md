# Phase 6A: Notification Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install notification provider SDKs (Resend, Twilio), configure environment variables, create the `notification_channel_config` table, and build reusable sender clients for email, SMS, and WhatsApp.

**Architecture:** Each delivery channel is encapsulated in its own server-side module under `apps/web/src/lib/notifications/`. A shared `NotificationPayload` type ties them together. The `notification_channel_config` table is owned by the admin and read by the scheduled processor. All sender functions throw on delivery failure so the caller can log and continue (non-fatal for individual sends).

**Tech Stack:** `resend` npm package, `twilio` npm package, native `fetch` for Meta WhatsApp Cloud API, Supabase Postgres, next-safe-action

## Global Constraints

- Depends on Phase 1A (notifications table), 1B (action clients)
- Migration prefix must be ≥ 20260623400000
- RLS must be enabled on every new table
- French UI — all user-visible strings in French
- Cash only — no payment references
- All commands run from `/home/sah/Synapse`
- No placeholder values — every env var key is the real key name; values are set in `.env.local` by the operator
- `notification_type` values: `'expiry_7d' | 'expiry_3d' | 'expiry_1d' | 'expired' | 'renewal_reminder'`

---

### Task 1: Install packages

**Files:**
- `apps/web/package.json` (modified by pnpm)

- [ ] **Step 1: Install Resend and Twilio SDKs**

```bash
cd apps/web && pnpm add resend twilio
```

Expected output: `dependencies` updated in `apps/web/package.json`, lock file updated.

- [ ] **Step 2: Verify install**

```bash
cd apps/web && node -e "require('resend'); require('twilio'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "feat(notifications): install resend and twilio packages"
```

---

### Task 2: Environment variables

**Files:**
- `.env.local` (create or append — never committed)
- `apps/web/src/env.ts` (add new keys to validation)

- [ ] **Step 1: Document required env vars**

Add the following block to `.env.local` (the operator fills in real values):

```bash
# Resend (email)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Twilio (SMS)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+216xxxxxxxx

# Meta WhatsApp Business Cloud API
WHATSAPP_API_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WHATSAPP_PHONE_NUMBER_ID=1234567890123456
```

- [ ] **Step 2: Add env validation**

Open `apps/web/src/env.ts` (or `apps/web/src/lib/env.ts` — check which exists) and add server-side keys:

```typescript
// Add to server schema (z.object({ ... })):
RESEND_API_KEY: z.string().min(1),
TWILIO_ACCOUNT_SID: z.string().startsWith('AC'),
TWILIO_AUTH_TOKEN: z.string().min(1),
TWILIO_FROM_NUMBER: z.string().startsWith('+216'),
WHATSAPP_API_TOKEN: z.string().min(1),
WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
```

- [ ] **Step 3: Commit (env.ts only — never commit .env.local)**

```bash
git add apps/web/src/env.ts
git commit -m "feat(notifications): add env var validation for notification channels"
```

---

### Task 3: notification_channel_config migration

**Files:**
- Create: `apps/database/supabase/migrations/20260623400000_notification_channel_config.sql`

- [ ] **Step 1: Write migration**

```sql
-- apps/database/supabase/migrations/20260623400000_notification_channel_config.sql

CREATE TABLE IF NOT EXISTS public.notification_channel_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL CHECK (
    notification_type IN ('expiry_7d', 'expiry_3d', 'expiry_1d', 'expired', 'renewal_reminder')
  ),
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'inapp')),
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_type, channel)
);

ALTER TABLE public.notification_channel_config ENABLE ROW LEVEL SECURITY;

-- Admin: full control
CREATE POLICY "admin_all_notification_channel_config"
  ON public.notification_channel_config
  FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Employees and service role: read only (for the API route processor)
CREATE POLICY "employee_read_notification_channel_config"
  ON public.notification_channel_config
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'employee'));

-- Seed default channel config (matches spec defaults)
INSERT INTO public.notification_channel_config (notification_type, channel, is_enabled)
VALUES
  ('expiry_7d',         'email',     true),
  ('expiry_7d',         'whatsapp',  true),
  ('expiry_7d',         'sms',       false),
  ('expiry_3d',         'email',     true),
  ('expiry_3d',         'whatsapp',  true),
  ('expiry_3d',         'sms',       false),
  ('expiry_1d',         'email',     true),
  ('expiry_1d',         'whatsapp',  true),
  ('expiry_1d',         'sms',       false),
  ('expired',           'email',     false),
  ('expired',           'sms',       true),
  ('expired',           'whatsapp',  true),
  ('renewal_reminder',  'email',     false),
  ('renewal_reminder',  'sms',       false),
  ('renewal_reminder',  'whatsapp',  true)
ON CONFLICT (notification_type, channel) DO NOTHING;

-- updated_at trigger
CREATE TRIGGER set_notification_channel_config_updated_at
  BEFORE UPDATE ON public.notification_channel_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

- [ ] **Step 2: Apply migration**

```bash
pnpm supabase db push --db-url "$DATABASE_URL"
```

Expected: Migration applied with no errors.

- [ ] **Step 3: Verify seeded rows**

```bash
pnpm supabase db execute --db-url "$DATABASE_URL" \
  --command "SELECT notification_type, channel, is_enabled FROM notification_channel_config ORDER BY notification_type, channel;"
```

Expected: 15 rows returned.

- [ ] **Step 4: Commit**

```bash
git add apps/database/supabase/migrations/20260623400000_notification_channel_config.sql
git commit -m "feat(db): add notification_channel_config table with RLS and seed data"
```

---

### Task 4: Email sender (Resend)

**Files:**
- Create: `apps/web/src/lib/notifications/email.ts`
- Create: `apps/web/src/lib/notifications/email.test.ts`

- [ ] **Step 1: Write email sender**

```typescript
// apps/web/src/lib/notifications/email.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface EmailPayload {
  to: string          // student email
  subject: string
  html: string
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const { error } = await resend.emails.send({
    from: 'Synapse <notifications@synapse-sfax.tn>',
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  })

  if (error) {
    throw new Error(`Resend delivery failed: ${error.message}`)
  }
}

// Template helpers

export function buildExpiryWarningEmail(opts: {
  studentName: string
  planName: string
  expiryDate: string   // formatted dd/MM/yyyy
  daysLeft: number
}): EmailPayload {
  const { studentName, planName, expiryDate, daysLeft } = opts
  return {
    to: '',  // caller sets this
    subject: `Votre abonnement Synapse expire dans ${daysLeft} jour(s)`,
    html: `
      <p>Bonjour ${studentName},</p>
      <p>Votre abonnement <strong>${planName}</strong> expire le <strong>${expiryDate}</strong> (dans ${daysLeft} jour(s)).</p>
      <p>Rendez-vous à Synapse pour le renouveler.</p>
      <p>— L'équipe Synapse, Sfax</p>
    `,
  }
}

export function buildExpiredEmail(opts: {
  studentName: string
  planName: string
  expiryDate: string
}): EmailPayload {
  const { studentName, planName, expiryDate } = opts
  return {
    to: '',
    subject: 'Votre abonnement Synapse est expiré',
    html: `
      <p>Bonjour ${studentName},</p>
      <p>Votre abonnement <strong>${planName}</strong> a expiré le <strong>${expiryDate}</strong>.</p>
      <p>Revenez nous voir pour le renouveler et retrouver votre place à Synapse !</p>
      <p>— L'équipe Synapse, Sfax</p>
    `,
  }
}

export function buildRenewalReminderEmail(opts: {
  studentName: string
  planName: string
  expiryDate: string
}): EmailPayload {
  const { studentName, planName, expiryDate } = opts
  return {
    to: '',
    subject: 'Rappel de renouvellement — Synapse',
    html: `
      <p>Bonjour ${studentName},</p>
      <p>Votre abonnement <strong>${planName}</strong> a expiré le <strong>${expiryDate}</strong>.</p>
      <p>Il n'est pas trop tard pour revenir — revenez nous voir pour vous réinscrire.</p>
      <p>— L'équipe Synapse, Sfax</p>
    `,
  }
}
```

- [ ] **Step 2: Write smoke test**

```typescript
// apps/web/src/lib/notifications/email.test.ts
import { describe, it, expect } from 'vitest'
import { buildExpiryWarningEmail, buildExpiredEmail, buildRenewalReminderEmail } from './email'

describe('email templates', () => {
  it('expiry warning subject includes days remaining', () => {
    const email = buildExpiryWarningEmail({
      studentName: 'Ahmed',
      planName: 'Mensuel',
      expiryDate: '30/06/2026',
      daysLeft: 7,
    })
    expect(email.subject).toContain('7 jour')
    expect(email.html).toContain('Ahmed')
    expect(email.html).toContain('Mensuel')
  })

  it('expired email body mentions expiry date', () => {
    const email = buildExpiredEmail({
      studentName: 'Fatma',
      planName: 'Hebdomadaire',
      expiryDate: '20/06/2026',
    })
    expect(email.subject).toContain('expiré')
    expect(email.html).toContain('20/06/2026')
  })

  it('renewal reminder subject correct', () => {
    const email = buildRenewalReminderEmail({
      studentName: 'Mohamed',
      planName: 'Mensuel',
      expiryDate: '17/06/2026',
    })
    expect(email.subject).toContain('renouvellement')
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd apps/web && pnpm test -- --reporter=verbose email.test
```

Expected: 3 passing.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/notifications/email.ts \
        apps/web/src/lib/notifications/email.test.ts
git commit -m "feat(notifications): add Resend email sender with French templates"
```

---

### Task 5: SMS sender (Twilio)

**Files:**
- Create: `apps/web/src/lib/notifications/sms.ts`
- Create: `apps/web/src/lib/notifications/sms.test.ts`

- [ ] **Step 1: Write SMS sender**

```typescript
// apps/web/src/lib/notifications/sms.ts
import twilio from 'twilio'

let _client: ReturnType<typeof twilio> | null = null

function getTwilioClient() {
  if (!_client) {
    _client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!,
    )
  }
  return _client
}

export interface SmsPayload {
  to: string    // Tunisian number, e.g. +21620000000
  body: string  // max 160 chars for single segment
}

export async function sendSms(payload: SmsPayload): Promise<void> {
  const client = getTwilioClient()
  await client.messages.create({
    from: process.env.TWILIO_FROM_NUMBER!,
    to: payload.to,
    body: payload.body,
  })
  // twilio SDK throws on error — no manual error check needed
}

// Template helpers

export function buildExpiredSms(opts: { studentName: string; expiryDate: string }): SmsPayload {
  return {
    to: '',  // caller sets this
    body: `Synapse: Bonjour ${opts.studentName}, votre abonnement a expiré le ${opts.expiryDate}. Passez nous voir pour le renouveler.`,
  }
}

export function buildExpiryWarningSms(opts: {
  studentName: string
  expiryDate: string
  daysLeft: number
}): SmsPayload {
  return {
    to: '',
    body: `Synapse: Bonjour ${opts.studentName}, votre abonnement expire le ${opts.expiryDate} (dans ${opts.daysLeft}j). Pensez à le renouveler.`,
  }
}
```

- [ ] **Step 2: Write tests**

```typescript
// apps/web/src/lib/notifications/sms.test.ts
import { describe, it, expect } from 'vitest'
import { buildExpiredSms, buildExpiryWarningSms } from './sms'

describe('sms templates', () => {
  it('expired sms mentions expiry date', () => {
    const sms = buildExpiredSms({ studentName: 'Ali', expiryDate: '20/06/2026' })
    expect(sms.body).toContain('20/06/2026')
    expect(sms.body).toContain('Ali')
    expect(sms.body.length).toBeLessThanOrEqual(160)
  })

  it('expiry warning sms includes days left', () => {
    const sms = buildExpiryWarningSms({
      studentName: 'Sara',
      expiryDate: '30/06/2026',
      daysLeft: 3,
    })
    expect(sms.body).toContain('3j')
    expect(sms.body.length).toBeLessThanOrEqual(160)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd apps/web && pnpm test -- --reporter=verbose sms.test
```

Expected: 2 passing.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/notifications/sms.ts \
        apps/web/src/lib/notifications/sms.test.ts
git commit -m "feat(notifications): add Twilio SMS sender with French templates"
```

---

### Task 6: WhatsApp sender (Meta Cloud API)

**Files:**
- Create: `apps/web/src/lib/notifications/whatsapp.ts`
- Create: `apps/web/src/lib/notifications/whatsapp.test.ts`

- [ ] **Step 1: Write WhatsApp sender**

```typescript
// apps/web/src/lib/notifications/whatsapp.ts

export interface WhatsAppTextPayload {
  to: string    // +216xxxxxxxx
  body: string
}

const GRAPH_API_URL = 'https://graph.facebook.com/v19.0'

export async function sendWhatsApp(payload: WhatsAppTextPayload): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!
  const token = process.env.WHATSAPP_API_TOKEN!

  const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: payload.to,
      type: 'text',
      text: { body: payload.body },
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`WhatsApp API error ${response.status}: ${errorBody}`)
  }
}

// Template helpers

export function buildExpiryWarningWhatsApp(opts: {
  studentName: string
  planName: string
  expiryDate: string
  daysLeft: number
}): WhatsAppTextPayload {
  return {
    to: '',
    body: `🎓 *Synapse Sfax*\n\nBonjour ${opts.studentName} !\n\nVotre abonnement *${opts.planName}* expire le *${opts.expiryDate}* (dans ${opts.daysLeft} jour(s)).\n\nPassez nous voir pour le renouveler. À bientôt !`,
  }
}

export function buildExpiredWhatsApp(opts: {
  studentName: string
  planName: string
  expiryDate: string
}): WhatsAppTextPayload {
  return {
    to: '',
    body: `🎓 *Synapse Sfax*\n\nBonjour ${opts.studentName},\n\nVotre abonnement *${opts.planName}* a expiré le *${opts.expiryDate}*.\n\nN'hésitez pas à revenir pour le renouveler. Nous vous attendons !`,
  }
}

export function buildRenewalReminderWhatsApp(opts: {
  studentName: string
  planName: string
  expiryDate: string
}): WhatsAppTextPayload {
  return {
    to: '',
    body: `🎓 *Synapse Sfax*\n\nBonjour ${opts.studentName},\n\nCela fait 3 jours que votre abonnement *${opts.planName}* a expiré (le ${opts.expiryDate}).\n\nRevenez nous voir — votre place vous attend ! 📚`,
  }
}
```

- [ ] **Step 2: Write tests**

```typescript
// apps/web/src/lib/notifications/whatsapp.test.ts
import { describe, it, expect } from 'vitest'
import {
  buildExpiryWarningWhatsApp,
  buildExpiredWhatsApp,
  buildRenewalReminderWhatsApp,
} from './whatsapp'

describe('whatsapp templates', () => {
  it('expiry warning mentions days left', () => {
    const msg = buildExpiryWarningWhatsApp({
      studentName: 'Youssef',
      planName: 'Mensuel',
      expiryDate: '30/06/2026',
      daysLeft: 7,
    })
    expect(msg.body).toContain('7 jour')
    expect(msg.body).toContain('Youssef')
    expect(msg.body).toContain('Mensuel')
  })

  it('expired message includes expiry date', () => {
    const msg = buildExpiredWhatsApp({
      studentName: 'Rima',
      planName: 'Hebdomadaire',
      expiryDate: '20/06/2026',
    })
    expect(msg.body).toContain('20/06/2026')
  })

  it('renewal reminder mentions 3 days', () => {
    const msg = buildRenewalReminderWhatsApp({
      studentName: 'Bilel',
      planName: 'Mensuel',
      expiryDate: '17/06/2026',
    })
    expect(msg.body).toContain('3 jours')
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd apps/web && pnpm test -- --reporter=verbose whatsapp.test
```

Expected: 3 passing.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/notifications/whatsapp.ts \
        apps/web/src/lib/notifications/whatsapp.test.ts
git commit -m "feat(notifications): add WhatsApp Cloud API sender with French templates"
```

---

### Task 7: Shared dispatcher

**Files:**
- Create: `apps/web/src/lib/notifications/dispatcher.ts`
- Create: `apps/web/src/data/admin/notification-channel-config.ts`

- [ ] **Step 1: Write channel config data layer**

```typescript
// apps/web/src/data/admin/notification-channel-config.ts
'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export type NotificationType =
  | 'expiry_7d'
  | 'expiry_3d'
  | 'expiry_1d'
  | 'expired'
  | 'renewal_reminder'

export type NotificationChannel = 'email' | 'sms' | 'whatsapp' | 'inapp'

export interface ChannelConfigRow {
  id: string
  notification_type: NotificationType
  channel: NotificationChannel
  is_enabled: boolean
}

export async function getEnabledChannels(
  notificationType: NotificationType,
): Promise<NotificationChannel[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('notification_channel_config')
    .select('channel')
    .eq('notification_type', notificationType)
    .eq('is_enabled', true)
  if (error) throw error
  return (data ?? []).map((r) => r.channel as NotificationChannel)
}

export async function getAllChannelConfigs(): Promise<ChannelConfigRow[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('notification_channel_config')
    .select('*')
    .order('notification_type')
    .order('channel')
  if (error) throw error
  return (data ?? []) as ChannelConfigRow[]
}

export async function upsertChannelConfig(
  notificationType: NotificationType,
  channel: NotificationChannel,
  isEnabled: boolean,
): Promise<void> {
  const supabase = await createSupabaseClient()
  const { error } = await supabase
    .from('notification_channel_config')
    .upsert(
      { notification_type: notificationType, channel, is_enabled: isEnabled, updated_at: new Date().toISOString() },
      { onConflict: 'notification_type,channel' },
    )
  if (error) throw error
}
```

- [ ] **Step 2: Write dispatcher**

```typescript
// apps/web/src/lib/notifications/dispatcher.ts
import { sendEmail } from './email'
import { sendSms } from './sms'
import { sendWhatsApp } from './whatsapp'
import type { NotificationChannel } from '@/data/admin/notification-channel-config'

export interface DispatchTarget {
  email?: string
  phone?: string  // +216xxxxxxxx format
}

export interface DispatchMessage {
  emailSubject: string
  emailHtml: string
  smsBody: string
  whatsappBody: string
}

/**
 * Dispatches a notification to all specified channels.
 * Errors per channel are caught and collected — a failed SMS does not block WhatsApp.
 */
export async function dispatch(
  channels: NotificationChannel[],
  target: DispatchTarget,
  message: DispatchMessage,
): Promise<{ channel: NotificationChannel; error: string | null }[]> {
  const results: { channel: NotificationChannel; error: string | null }[] = []

  for (const channel of channels) {
    try {
      if (channel === 'email') {
        if (!target.email) throw new Error('No email address for target')
        await sendEmail({
          to: target.email,
          subject: message.emailSubject,
          html: message.emailHtml,
        })
      } else if (channel === 'sms') {
        if (!target.phone) throw new Error('No phone number for target')
        await sendSms({ to: target.phone, body: message.smsBody })
      } else if (channel === 'whatsapp') {
        if (!target.phone) throw new Error('No phone number for target')
        await sendWhatsApp({ to: target.phone, body: message.whatsappBody })
      }
      results.push({ channel, error: null })
    } catch (err) {
      results.push({
        channel,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return results
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/notifications/dispatcher.ts \
        apps/web/src/data/admin/notification-channel-config.ts
git commit -m "feat(notifications): add channel config data layer and multi-channel dispatcher"
```

---

## Self-Review

- [ ] `notification_channel_config` has RLS enabled with correct admin/employee policies
- [ ] All 15 seed rows match the spec defaults (email+WhatsApp for expiry warnings, SMS+WhatsApp for expired, WhatsApp only for renewal)
- [ ] `sendEmail`, `sendSms`, `sendWhatsApp` all throw on error — callers handle non-fatal failures
- [ ] Dispatcher collects per-channel errors without aborting the loop
- [ ] No secrets committed — `.env.local` pattern only
- [ ] All user-visible strings (email HTML, SMS bodies, WhatsApp messages) are in French
- [ ] Tunisian phone numbers use `+216` prefix throughout
- [ ] 8 tests total passing across email, sms, whatsapp modules
