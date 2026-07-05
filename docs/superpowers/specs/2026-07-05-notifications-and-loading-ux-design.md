# Notifications & Loading UX — Design

Date: 2026-07-05
Status: Approved (pending spec review)

## Problem

Three related gaps in the PWA notification/UX experience, plus a loading-state
polish item:

1. **No in-app drop-down.** A new notification only updates the bell badge.
   There is no attention-grabbing surface when a notification arrives while the
   user is in the app.
2. **Phone push is broken.** Multiple causes (see below): the service worker
   failed to register due to a middleware redirect (fixed separately this
   session), the settings "Notifications push" toggle never actually enrolls the
   device, and the proactive prompt modal is dead code.
3. **No proactive enable prompt.** `PushPromptModal` exists but is never mounted.
4. **Blank pages before load.** Only one `loading.tsx` per role covers all
   nested pages; client-fetched pages show nothing while data loads.

## Root Causes (push)

- **SW registration redirect** (already fixed): `proxy.ts` matcher did not
  exclude `/sw.js`, so the SW script was served behind a 307 auth redirect — a
  hard SW registration error. Fixed by excluding `sw.js` + `manifest.json` from
  the matcher.
- **Settings toggle is a pref flag only:** `StudentSettingsClient` push `Switch`
  calls only `updateNotificationPrefsAction` (writes DB `push_enabled`). It never
  calls `usePushSubscription.subscribe()`, never requests browser permission,
  never creates a `push_subscriptions` row. Toggling ON does nothing on-device.
- **Dead prompt:** `PushPromptModal` + `usePushPrompt` are implemented but the
  modal is not mounted anywhere.
- **Ops risk:** if `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` are not
  set in prod, `subscribe()` returns early and `sendPushToUsers` no-ops
  regardless of code. Must be verified in Vercel env (not a code change).

## Design

### 1. In-app top drop-down (`NotificationToaster`)

New client component mounted in `DynamicLayoutProviders` (root `app/layout.tsx`,
shared by all roles).

- Subscribes to Supabase `postgres_changes`, event `INSERT`, table
  `notifications`, filter `user_id=eq.<uid>` — same pattern as `NotificationBell`.
- On INSERT, fires a `sonner` toast with `position: 'top-center'`, a bell icon,
  and the notification `message`.
- **Tap behavior:** the `notifications` row has no link/url column (shape:
  `id, type, message, is_read, created_at`), so the toast derives a destination
  from a small `type → route` map (e.g. reservation types → `/student/...`).
  Unknown types → tapping just dismisses (no navigation). This map lives with the
  toaster and is the only place `type`-to-route lives on the client.
- Only reacts to rows arriving after mount (realtime INSERT stream is inherently
  post-mount; no backfill query), so it never replays existing notifications.
- **De-dupe with the bell:** the bell keeps owning its list; the toaster only
  raises the toast. Two separate realtime channels (one per component), accepted
  as a minor connection cost in exchange for not refactoring the bell. Channel
  topic uses the same unique-suffix trick to avoid Supabase topic collisions.
- Renders nothing (returns `null`); it is a side-effect-only component. No-ops
  when there is no authenticated user.

### 2. Settings push toggle enrolls the device

`StudentSettingsClient` push `Switch` is rewired to reflect and control the real
device subscription via `usePushSubscription`:

- **Displayed state** = `subscribed && push_enabled`.
- **Toggle ON:** call `subscribe()` (browser permission + `pushManager.subscribe`
  + persist subscription), then save `push_enabled = true`. If the user denies
  permission, revert the switch and surface a hint.
- **Toggle OFF:** call `unsubscribe()` and save `push_enabled = false`.
- **Unsupported / iOS-not-installed:** when `usePushSubscription.supported` is
  false, do not show a dead toggle. If the device is iOS Safari not running as an
  installed PWA (detectable via `navigator.standalone` / display-mode +
  UA), show an "Add to Home Screen to enable notifications" hint (iOS only allows
  web push in an installed PWA, iOS 16.4+). Otherwise show a generic
  "not supported on this browser" note.
- **Permission denied:** show a hint linking to browser/site settings; keep the
  toggle off and disabled.

The optimistic-update + revert-on-error pattern already used in this file
(leaderboard toggle) is reused for consistency.

### 3. Revive the enable prompt

Mount the existing `PushPromptModal` in `DynamicLayoutProviders`. `usePushPrompt`
already gates on support, existing subscription, `Notification.permission`, an
authenticated user, and a 3-day re-nag window (localStorage). No new logic — just
wire the mount.

### 4. Animated loading states (shimmer + staggered entrance, hot paths)

- **Base `Skeleton`:** add a shimmer gradient sweep layered on the existing
  `animate-pulse`. Gated on `prefers-reduced-motion` (reduced → static/pulse
  only). Every existing skeleton benefits with no per-call change.
- **`SkeletonGroup`:** new wrapper using `motion` (already a dep, v12) that
  staggers a fade/slide-in of its child skeleton blocks so the placeholder reads
  as intentional UI rather than a flash. Reduced-motion → instant, no transform.
- **Shape-matched `loading.tsx`:** add layout-matched skeletons for student PWA
  hot paths (`dashboard`, `history`, `rewards`, `reservation`, `rooms`) and the
  role landing pages. Remaining routes inherit the improved generic role-level
  skeleton.
- **Client-fetched pages:** pages that fetch via `useEffect`/actions bypass
  `loading.tsx` (no server Suspense boundary). Hot ones among these get an inline
  skeleton state, built from the same `Skeleton`/`SkeletonGroup` components,
  shown while their client data loads.

## Scope

**In scope:** items 1–4 above; the already-applied `proxy.ts` matcher fix.

**Out of scope (YAGNI):** custom (non-sonner) branded banner UI; per-type toast
filtering; notification grouping/threading; shape-matched skeletons for all 58
pages (only hot paths this pass); refactoring the bell + toaster onto a single
shared realtime channel.

**Ops (not code, must verify):** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and
`VAPID_PRIVATE_KEY` present in prod Vercel env.

## Testing

- **`NotificationToaster`:** inserting a `notifications` row for the current user
  raises exactly one top-center toast; tapping a known-type toast navigates,
  unknown-type dismisses; no toast for other users' rows; no replay of
  pre-existing notifications on mount.
- **Settings toggle:** ON with permission granted creates a `push_subscriptions`
  row and sets `push_enabled`; ON with permission denied reverts the switch and
  shows the hint; OFF removes the subscription and clears the pref; displayed
  state matches actual subscription after reload. iOS-not-installed shows the
  install hint, not a dead toggle.
- **Prompt:** appears for a supported, unsubscribed, authenticated user after the
  existing delay; respects the 3-day dismissal window; never appears when
  permission is denied or already subscribed.
- **Loading states:** shimmer/stagger render under normal motion; both collapse
  to static under `prefers-reduced-motion`; hot-path `loading.tsx` shapes match
  their loaded page layout; client-fetched hot pages show a skeleton before data.
