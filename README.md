# Synapse

Study space management platform: seat reservations, check-in/check-out, subscriptions, and student management for co-working / study rooms.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Database & Auth:** Supabase (Postgres, RLS, Auth)
- **Server actions:** `next-safe-action` + Zod
- **UI:** shadcn/ui, Tailwind CSS & Framer Motion
- **Monorepo:** Turborepo + pnpm workspaces
- **Notifications:** Resend (email), Twilio (SMS), WhatsApp Cloud API

## Structure

```
apps/
  web/         Next.js app (admin, employee, student portals)
  database/    Supabase project — migrations, seed, config
packages/
  typescript-config/
```

Three role-based areas in `apps/web/src/app`: `admin/`, `employee/`, `student/`. Server actions live in `src/actions`, DB queries in `src/data`, shared logic in `src/lib`.

## Features

- **Auth** — Supabase SSR auth, role-based routing (admin / employee / student).
- **Rooms & seat maps** — live seat maps per room, reservations, seat swap requests, admin room editor.
- **Check-in / check-out** — QR-based (HMAC-signed) check-in flow, attendance tracking.
- **Subscriptions & purchases** — student subscriptions, loyalty program, redemption requests.
- **Notifications** — expiry/renewal reminders over in-app, email, SMS, and WhatsApp, dispatched via a scheduled cron job.
- **Admin** — account categories, exports, accounting, notification channel config.

## Local setup

```bash
pnpm install
cp .env.local.example .env.local
cp .env.development.local.example .env.development.local   # if present

pnpm database#start        # starts local Supabase stack
pnpm supabase:sync-env      # syncs local Supabase keys into env files
pnpm gen-types-local

pnpm dev                    # http://localhost:3000
```

## Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, privileged Supabase access |
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` | Canonical app URL |
| `CRON_SECRET` | Authenticates the notifications cron endpoint |
| `QR_HMAC_SECRET` | Signs check-in QR codes |
| `RESEND_API_KEY` | Email notifications |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | SMS notifications |
| `WHATSAPP_API_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp notifications |

Never commit real values — these are secrets. `SUPABASE_SERVICE_ROLE_KEY` in particular bypasses RLS.

## Scripts

```bash
pnpm dev          # run all apps
pnpm build        # build all apps
pnpm test         # vitest
pnpm test:e2e     # playwright
pnpm typecheck    # tsc --noEmit
pnpm lint         # oxlint
pnpm gen-types    # regenerate database.types.ts from linked Supabase project
```

## Deployment

1. Create a Supabase project, then from `apps/database`: `supabase link --project-ref <ref> && supabase db push`.
2. Add prod redirect URLs in Supabase Auth settings.
3. Deploy `apps/web` to Vercel (root directory: `apps/web`) with the env vars above set.
4. `apps/web/vercel.json` schedules the notifications cron — Vercel picks it up automatically on deploy.

## License

Proprietary — internal project.
