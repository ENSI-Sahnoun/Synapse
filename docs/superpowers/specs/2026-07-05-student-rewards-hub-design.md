# Student Rewards Hub — Design Spec

**Date:** 2026-07-05
**Status:** Approved for planning

## Purpose

Give the student gamification system (monthly leaderboard + loyalty points) a standalone, animated page instead of living as a large card on the dashboard and a plain `/student/loyalty` page. The dashboard keeps only a compact teaser.

## Decisions (validated with user)

- **Scope:** full hub — leaderboard + loyalty points/rewards/history merged into one page.
- **Old pieces:** replace both. `/student/loyalty` redirects to the new route; the dashboard `LeaderboardCard` is removed and replaced by a compact teaser.
- **Animations:** install the `motion` package (framer-motion successor).
- **Layout:** points hero at top + 3 internal tabs (Classement / Récompenses / Historique).
- **Hero style:** dark premium — brown-to-gold gradient, gold accent number ("VIP card" feel).

## Route & Navigation

- New route: `apps/web/src/app/student/rewards/page.tsx` (server component).
- `apps/web/src/app/student/loyalty/page.tsx` becomes a `redirect('/student/rewards')` (or the directory is deleted and a redirect added — implementation plan decides the cleanest Next.js mechanism).
- `StudentBottomNav`: the "Récompenses" tab href changes from `/student/loyalty` to `/student/rewards`; icon changes from `Star` to `Trophy`.
- Dashboard (`app/student/dashboard/page.tsx`): remove `<LeaderboardCard …>` and its data fetches that are no longer needed there; add `GamificationTeaser` — a small card showing my leaderboard rank (primary category) + points balance + arrow link to `/student/rewards`. Delete `LeaderboardCard.tsx`.

## Page Structure

### Hero — "PointsHero" (dark gold)

- Background: dark brown → warm brown gradient (`#2b2419` → `#4a3b23` family, using Synapse tokens where possible); points number in gold (`#ffd873` family).
- Points balance animates with a count-up on mount (motion spring / animated number).
- Weekly delta line ("+45 cette semaine") computed from the ledger (sum of `points_delta` over last 7 days).
- Subtle gold shimmer sweep on load. Respect `prefers-reduced-motion`: disable count-up/shimmer, render final values.
- Progress bar toward the **cheapest reward the student cannot yet afford**: "Plus que N pts → {reward}". Hidden if no active rules or all rewards affordable.
- No "levels" — the data model has none; do not invent.

### Tabs

Three pill tabs under the hero: **Classement / Récompenses / Historique**. Active pill indicator animates (layout animation); panel content slides/fades on switch. Client-side state only, no URL change (YAGNI; can add `?tab=` later if needed).

If leaderboard is disabled in settings (or no enabled categories), the Classement tab is hidden and Récompenses becomes the default tab. Hub still works points-only.

#### Panel 1 — Classement

Reuses today's leaderboard logic/data:

- Category chips (visits / hours / spend from `getLeaderboardConfig`), same enable/sort rules as current `LeaderboardCard`.
- Podium (2nd/1st/3rd order): bars rise with a staggered spring animation on mount and on category switch; medals 🥈🥇🥉.
- Ranks 4+: staggered fade-in list, same row format as today.
- "Votre position" banner pinned at the panel bottom (same content as today).
- Prize label logic unchanged (`prizeSecret` → "🎁 Prix mystère", else points breakdown).
- Empty state: "Pas encore de classement ce mois-ci."

#### Panel 2 — Récompenses

Reuses `/student/loyalty` logic/data:

- Reward cards from `getActiveLoyaltyRules`: each shows a circular progress ring (balance vs `points_threshold`), name, reward-type label (existing label maps), threshold.
- Affordable rewards: gold border + "✓ Disponible"; unaffordable: dimmed ring, muted.
- Existing `RequestButton` component reused as-is (moved/imported from its current location).
- Redemption request history below the grid (same status labels/colors as today).
- Empty state: "Aucune récompense active pour le moment."

#### Panel 3 — Historique

- Points ledger from `getStudentLoyaltyLedger`: staggered entrance, existing reason labels, `+` green / `−` red deltas, dates in `fr` locale.
- Empty state: current "Aucun point gagné…" copy.

## Architecture

- `page.tsx` (server): fetches in parallel — `getStudentLoyaltyBalance`, `getStudentLoyaltyLedger`, `getActiveLoyaltyRules`, `getStudentPendingRequestRuleIds`, `getStudentRedemptionRequests`, `getLeaderboard`, `getMyLeaderboardRank`, `getLeaderboardSettings`, `getLeaderboardConfig`. Passes plain props to the client hub.
- Client components under `app/student/rewards/`:
  - `RewardsHub.tsx` — tab state, panel switching.
  - `PointsHero.tsx` — count-up, shimmer, next-reward progress.
  - `LeaderboardPanel.tsx` — chips + podium + list + my rank.
  - `RewardsPanel.tsx` — reward cards + request history.
  - `HistoryPanel.tsx` — ledger.
- `components/student/GamificationTeaser.tsx` — dashboard teaser (server-renderable; no motion needed, simple CSS transition).
- Dependency: add `motion` to `apps/web` package.json.
- Styling: existing CSS custom properties (`--synapse-*`) + Tailwind utilities, matching current student pages. French copy throughout.

## Error Handling / Edge Cases

- Auth/role guarding already handled by `student/layout.tsx`.
- Leaderboard disabled → tab hidden (see above).
- No active subscription / zero points → hero shows 0 with same layout; progress bar shows full distance to first reward.
- Data fetch failures follow the same behavior as current pages (no new try/catch semantics introduced).
- `prefers-reduced-motion` honored across all animations.

## Testing

- Existing e2e specs referencing `/student/loyalty` must be updated to the new route (search `e2e/` for `loyalty`).
- New/updated e2e: rewards page renders hero balance, three tabs switch, redirect from `/student/loyalty` works, dashboard shows teaser instead of leaderboard card.
- Unit-level: next-reward progress computation (cheapest unaffordable rule) if extracted as a pure helper.

## Out of Scope

- Levels/badges/streaks (no data model support).
- Confetti (user chose plain motion lib option).
- URL-synced tabs, push notifications, admin-side changes.
