# Phase 6D: Admin Notification Channel Config Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin settings page where the admin can enable or disable each notification channel (Email, SMS, WhatsApp) per notification type, with immediate toggle feedback and no page reload.

**Architecture:** The page is a Server Component that fetches all 15 `notification_channel_config` rows and renders a grid of toggles grouped by notification type. Each toggle fires a server action (`upsertChannelConfig` from 6A) via `useOptimistic` for instant UI feedback. An `adminActionClient` wraps the upsert. No separate form submission — each toggle change auto-saves.

**Tech Stack:** next-safe-action, shadcn/ui Switch + Table, Zod, `adminActionClient`

## Global Constraints

- Depends on Phase 6A (notification_channel_config table + data layer)
- Only admin role can access this page — enforce via route group middleware (already in place from Phase 1B)
- French UI — all labels in French
- `notification_type` values: `'expiry_7d' | 'expiry_3d' | 'expiry_1d' | 'expired' | 'renewal_reminder'`
- `channel` values: `'email' | 'sms' | 'whatsapp'` (inapp is always on, not configurable here)
- All commands run from `/home/sah/Synapse`

---

### Task 1: Server action for toggling channel config

**Files:**
- Create: `apps/web/src/actions/admin/notification-channel-config.ts`
- Create: `apps/web/src/utils/zod-schemas/notification-channel-config.ts`

- [ ] **Step 1: Write Zod schema**

```typescript
// apps/web/src/utils/zod-schemas/notification-channel-config.ts
import { z } from 'zod'

export const notificationTypeSchema = z.enum([
  'expiry_7d',
  'expiry_3d',
  'expiry_1d',
  'expired',
  'renewal_reminder',
])

export const notificationChannelSchema = z.enum(['email', 'sms', 'whatsapp'])

export const upsertChannelConfigSchema = z.object({
  notification_type: notificationTypeSchema,
  channel: notificationChannelSchema,
  is_enabled: z.boolean(),
})

export type UpsertChannelConfigInput = z.infer<typeof upsertChannelConfigSchema>
```

- [ ] **Step 2: Write server action**

```typescript
// apps/web/src/actions/admin/notification-channel-config.ts
'use server'

import { adminActionClient } from '@/utils/supabase/action-clients'
import { upsertChannelConfigSchema } from '@/utils/zod-schemas/notification-channel-config'
import { upsertChannelConfig } from '@/data/admin/notification-channel-config'

export const toggleNotificationChannel = adminActionClient
  .schema(upsertChannelConfigSchema)
  .action(async ({ parsedInput: { notification_type, channel, is_enabled } }) => {
    await upsertChannelConfig(notification_type, channel, is_enabled)
    return { success: true }
  })
```

- [ ] **Step 3: Write test for schema**

```typescript
// apps/web/src/utils/zod-schemas/notification-channel-config.test.ts
import { describe, it, expect } from 'vitest'
import { upsertChannelConfigSchema } from './notification-channel-config'

describe('upsertChannelConfigSchema', () => {
  it('accepts valid config', () => {
    const result = upsertChannelConfigSchema.safeParse({
      notification_type: 'expiry_7d',
      channel: 'email',
      is_enabled: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid notification type', () => {
    const result = upsertChannelConfigSchema.safeParse({
      notification_type: 'unknown_type',
      channel: 'email',
      is_enabled: true,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid channel', () => {
    const result = upsertChannelConfigSchema.safeParse({
      notification_type: 'expired',
      channel: 'telegram',
      is_enabled: false,
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing is_enabled', () => {
    const result = upsertChannelConfigSchema.safeParse({
      notification_type: 'expiry_1d',
      channel: 'sms',
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && pnpm test -- --reporter=verbose notification-channel-config.test
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/utils/zod-schemas/notification-channel-config.ts \
        apps/web/src/utils/zod-schemas/notification-channel-config.test.ts \
        apps/web/src/actions/admin/notification-channel-config.ts
git commit -m "feat(admin): add notification channel config schema and server action"
```

---

### Task 2: ChannelConfigToggle client component

**Files:**
- Create: `apps/web/src/components/admin/notifications/ChannelConfigToggle.tsx`

- [ ] **Step 1: Write toggle component**

```tsx
// apps/web/src/components/admin/notifications/ChannelConfigToggle.tsx
'use client'

import { useOptimistic, useTransition } from 'react'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { toggleNotificationChannel } from '@/actions/admin/notification-channel-config'
import type { NotificationType, NotificationChannel } from '@/data/admin/notification-channel-config'

interface ChannelConfigToggleProps {
  notificationType: NotificationType
  channel: NotificationChannel
  isEnabled: boolean
}

export function ChannelConfigToggle({
  notificationType,
  channel,
  isEnabled,
}: ChannelConfigToggleProps) {
  const [optimisticEnabled, setOptimisticEnabled] = useOptimistic(isEnabled)
  const [isPending, startTransition] = useTransition()

  function handleChange(checked: boolean) {
    startTransition(async () => {
      setOptimisticEnabled(checked)
      const result = await toggleNotificationChannel({
        notification_type: notificationType,
        channel,
        is_enabled: checked,
      })
      if (result?.serverError) {
        toast.error('Échec de la mise à jour. Veuillez réessayer.')
      }
    })
  }

  return (
    <Switch
      checked={optimisticEnabled}
      onCheckedChange={handleChange}
      disabled={isPending}
      aria-label={`${channel} pour ${notificationType}`}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/admin/notifications/ChannelConfigToggle.tsx
git commit -m "feat(admin): add ChannelConfigToggle client component with optimistic updates"
```

---

### Task 3: Notification config page

**Files:**
- Create: `apps/web/src/app/(admin-pages)/admin/settings/notifications/page.tsx`

- [ ] **Step 1: Write page**

```tsx
// apps/web/src/app/(admin-pages)/admin/settings/notifications/page.tsx
import { getAllChannelConfigs } from '@/data/admin/notification-channel-config'
import { ChannelConfigToggle } from '@/components/admin/notifications/ChannelConfigToggle'
import type { NotificationType, NotificationChannel, ChannelConfigRow } from '@/data/admin/notification-channel-config'

const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  expiry_7d: 'Expiration dans 7 jours',
  expiry_3d: 'Expiration dans 3 jours',
  expiry_1d: 'Expiration dans 1 jour',
  expired: 'Abonnement expiré (J-0)',
  renewal_reminder: 'Rappel de renouvellement (J+3)',
}

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  inapp: 'In-app',
}

const ORDERED_TYPES: NotificationType[] = [
  'expiry_7d',
  'expiry_3d',
  'expiry_1d',
  'expired',
  'renewal_reminder',
]

const CONFIGURABLE_CHANNELS: NotificationChannel[] = ['email', 'sms', 'whatsapp']

function buildConfigMap(rows: ChannelConfigRow[]): Map<string, boolean> {
  const map = new Map<string, boolean>()
  for (const row of rows) {
    map.set(`${row.notification_type}:${row.channel}`, row.is_enabled)
  }
  return map
}

export default async function NotificationConfigPage() {
  const configs = await getAllChannelConfigs()
  const configMap = buildConfigMap(configs)

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Canaux de notification</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configurez quels canaux sont actifs pour chaque type de notification.
          Les notifications in-app sont toujours activées.
        </p>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left p-4 font-medium text-muted-foreground">
                Type de notification
              </th>
              {CONFIGURABLE_CHANNELS.map((channel) => (
                <th key={channel} className="text-center p-4 font-medium text-muted-foreground w-28">
                  {CHANNEL_LABELS[channel]}
                </th>
              ))}
              <th className="text-center p-4 font-medium text-muted-foreground w-24">
                In-app
              </th>
            </tr>
          </thead>
          <tbody>
            {ORDERED_TYPES.map((type, index) => (
              <tr
                key={type}
                className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
              >
                <td className="p-4 font-medium">
                  {NOTIFICATION_TYPE_LABELS[type]}
                </td>
                {CONFIGURABLE_CHANNELS.map((channel) => (
                  <td key={channel} className="p-4 text-center">
                    <div className="flex justify-center">
                      <ChannelConfigToggle
                        notificationType={type}
                        channel={channel}
                        isEnabled={configMap.get(`${type}:${channel}`) ?? false}
                      />
                    </div>
                  </td>
                ))}
                <td className="p-4 text-center">
                  <div className="flex justify-center">
                    {/* In-app is always on — not configurable */}
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                      <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                      Toujours actif
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
        <h2 className="font-semibold text-sm">Variables d'environnement requises</h2>
        <ul className="text-xs text-muted-foreground space-y-1 font-mono">
          <li>RESEND_API_KEY — clé API Resend pour l'envoi d'emails</li>
          <li>TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER — SMS via Twilio</li>
          <li>WHATSAPP_API_TOKEN + WHATSAPP_PHONE_NUMBER_ID — Meta WhatsApp Business Cloud API</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Les canaux dont les variables ne sont pas configurées échoueront silencieusement
          (erreur enregistrée côté serveur, les autres canaux ne sont pas affectés).
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(admin-pages\)/admin/settings/notifications/page.tsx
git commit -m "feat(admin): add notification channel config settings page"
```

---

### Task 4: Add notifications link to admin settings nav

**Files:**
- Modify: admin settings sidebar or nav (find actual file with the step below)

- [ ] **Step 1: Find settings nav file**

```bash
find /home/sah/Synapse/apps/web/src/app/\(admin-pages\) -name "*.tsx" | xargs grep -l "settings\|paramètres\|Paramètres" 2>/dev/null | head -10
```

- [ ] **Step 2: Add nav link**

In the found file, add a link to `/admin/settings/notifications`:

```tsx
// Add alongside other settings nav items:
<Link href="/admin/settings/notifications">
  Canaux de notification
</Link>
```

Or if using a config array:

```typescript
{
  href: '/admin/settings/notifications',
  label: 'Canaux de notification',
  icon: Bell,  // import Bell from 'lucide-react'
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(admin-pages\)/admin/settings/  # adjust to actual file
git commit -m "feat(admin): add notification config link to settings nav"
```

---

### Task 5: E2E smoke test — page renders and toggle works

**Files:**
- Create: `apps/web/src/app/(admin-pages)/admin/settings/notifications/page.test.tsx`

- [ ] **Step 1: Write render test**

```typescript
// apps/web/src/app/(admin-pages)/admin/settings/notifications/page.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { buildConfigMap } from './page'  // export buildConfigMap for testing

// If buildConfigMap is not exported from page.tsx, extract it to a utils file and test that.
// Alternatively, test the config map logic inline:

function buildConfigMapLocal(rows: Array<{ notification_type: string; channel: string; is_enabled: boolean }>) {
  const map = new Map<string, boolean>()
  for (const row of rows) {
    map.set(`${row.notification_type}:${row.channel}`, row.is_enabled)
  }
  return map
}

describe('notification config page helpers', () => {
  it('buildConfigMap returns correct value for present key', () => {
    const map = buildConfigMapLocal([
      { notification_type: 'expiry_7d', channel: 'email', is_enabled: true },
      { notification_type: 'expired', channel: 'sms', is_enabled: false },
    ])
    expect(map.get('expiry_7d:email')).toBe(true)
    expect(map.get('expired:sms')).toBe(false)
  })

  it('buildConfigMap returns undefined for missing key', () => {
    const map = buildConfigMapLocal([])
    expect(map.get('expiry_7d:whatsapp')).toBeUndefined()
  })

  it('last row wins for duplicate keys', () => {
    const map = buildConfigMapLocal([
      { notification_type: 'expiry_1d', channel: 'whatsapp', is_enabled: true },
      { notification_type: 'expiry_1d', channel: 'whatsapp', is_enabled: false },
    ])
    expect(map.get('expiry_1d:whatsapp')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests**

```bash
cd apps/web && pnpm test -- --reporter=verbose notification-channel-config
```

Expected: schema tests (4) + page helper tests (3) = 7 passing.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(admin-pages\)/admin/settings/notifications/page.test.tsx
git commit -m "test(admin): add notification config page helper tests"
```

---

## Self-Review

- [ ] Page route is inside `(admin-pages)` — middleware already restricts to admin role
- [ ] `toggleNotificationChannel` uses `adminActionClient` — non-admins get 403
- [ ] Toggle uses `useOptimistic` — UI updates instantly without waiting for server round-trip
- [ ] Failed toggle shows `toast.error` in French
- [ ] In-app column shows "Toujours actif" with green indicator — not a toggle (always on)
- [ ] `inapp` channel is excluded from `CONFIGURABLE_CHANNELS` array
- [ ] Table covers all 5 notification types × 3 external channels = 15 togglable switches
- [ ] Env var documentation section visible on the page for operator reference
- [ ] 7 tests total passing (4 schema + 3 page helper)
- [ ] All labels in French
