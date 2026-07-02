# Historical Analytics + Student Leaderboard

Date: 2026-07-02

## Problem

Admin dashboard and employee reports only show today's snapshot (revenue,
occupancy, new members, hourly chart). No way to see trends over time, no
per-room/per-day breakdown, no dwell-time or subscription-lifecycle
visibility, and no engagement mechanic for students.

## Goals

1. New `/admin/analytics` page: calendar-first historical view of
   occupancy, revenue, dwell time, and subscription lifecycle.
2. Monthly leaderboard (hours studied / visit count) for admin and students.
3. Opt-out control for students who don't want to appear on the
   student-facing leaderboard.

Out of scope (deferred): audit log, expiring-subscription alerts, shift
handoff, attendance search, capacity alerts, waitlist/refund flows, the dead
"Télécharger rapport" button (tracked separately as a bug fix, not part of
this feature).

## UI

### `/admin/analytics`

- **Calendar tab (default)**: month grid, one cell per day. Cell shading
  encodes a metric (toggle: occupancy % / revenue) via existing dataviz
  palette conventions. Month navigation (prev/next), defaults to current
  month.
- **Day detail panel**: opens on cell click (inline panel below calendar,
  not a modal — keeps calendar visible for re-selecting). Shows for the
  selected day:
  - Hourly occupancy curve (reuse the bar-chart pattern from
    `employee/reports/page.tsx`, extended to any day not just today)
  - Revenue breakdown: subscriptions vs purchases (stacked bar or two
    stat cards)
  - Avg + median dwell time (closed sessions only)
  - Subscriptions sold / expired that day
  - Capacity utilization %: occupied-seat-time / total-seat-time for the
    day, not just peak headcount
- **Trends tab**: 7/30/90d range selector (shared across all four charts).
  Line charts: occupancy %, revenue (stacked by source), avg dwell time,
  active subscription count. Reuses existing `RevenuePoint`-style chart
  components from the admin dashboard.
- **Leaderboard widget**: month selector (defaults current month), toggle
  "Most hours" / "Most visits", top 10 with full names (admin view, no
  opt-out restriction applies to admin's own view).

### `/student/dashboard` (new leaderboard section)

- Top 10 for current month (hours/visits toggle), student's own row
  highlighted; if student is outside top 10, an extra "your rank" row is
  appended.
- Students with `leaderboard_visible = false` are excluded from other
  students' lists but still see their own stats/rank privately (computed
  against the full, unfiltered ranking).

### `/student/settings` (new toggle)

- "Apparaître dans le classement" (leaderboard visibility) toggle, same
  pattern as existing notification-prefs toggles in
  `StudentSettingsToggles`/`StudentSettingsClient`. Default: on.

## Data Model

New migration: `profiles.leaderboard_visible boolean not null default true`.

No other schema changes — all analytics are computed from existing tables
(`attendance`, `seats`, `rooms`, `subscriptions`, `purchases`,
`purchase_items`).

## Data/Query Layer

New file `apps/web/src/data/admin/analytics.ts`:
- `getOccupancyForDay(date: string): Promise<HourlyOccupancy[]>` — per-hour
  occupied-seat count vs total seats, for the calendar day-detail panel.
- `getOccupancyTrend(days: number): Promise<OccupancyPoint[]>` — daily
  capacity utilization % over the range, for the trends tab.
- `getDwellTimeForDay(date: string): Promise<{ avgMinutes: number;
  medianMinutes: number }>`
- `getDwellTimeTrend(days: number): Promise<DwellPoint[]>`
- `getSubscriptionLifecycleForDay(date: string): Promise<{ sold: number;
  expired: number }>`
- `getSubscriptionLifecycleTrend(days: number):
  Promise<SubscriptionLifecyclePoint[]>` — active count per day (derived
  from `start_date`/`end_date` ranges), sold/expired per day.
- `getRevenueBreakdownForDay(date: string): Promise<{ subscriptions:
  number; purchases: number }>`
- `getRevenueBreakdownTrend(days: number): Promise<RevenueBreakdownPoint[]>`
- `getCalendarMonthSummary(year: number, month: number):
  Promise<Record<string, { occupancyPct: number; revenue: number }>>` —
  lightweight per-day aggregate for coloring calendar cells (one query,
  not N queries per day).

New file `apps/web/src/data/shared/leaderboard.ts` (shared by admin and
student, since the underlying query is identical — only the visibility
filter differs):
- `getMonthlyLeaderboard(params: { year: number; month: number; metric:
  'hours' | 'visits'; viewerRole: 'admin' | 'student'; viewerId?: string
  }): Promise<{ rank: number; studentId: string; name: string; value:
  number }[]>`
  - Computed from `attendance` grouped by `student_id`, filtered to the
    month, `checked_out_at IS NOT NULL`.
  - `metric: 'hours'` sums `checked_out_at - checked_in_at`;
    `metric: 'visits'` counts rows.
  - When `viewerRole === 'student'`, joins `profiles.leaderboard_visible`
    and excludes `false` rows from the general list, then separately
    computes and appends the viewer's own rank (against the unfiltered
    set) if not already present in the top 10.

New action: `apps/web/src/actions/student/leaderboard.ts` —
`updateLeaderboardVisibilityAction` (mirrors the existing notification-prefs
action pattern), updates `profiles.leaderboard_visible`.

## Error Handling

- Empty months (no attendance data) render empty-state charts, not errors.
- Calendar cells with no data render as neutral/unshaded, not zero-colored
  (avoid implying "zero activity" when it's actually "before data existed"
  vs genuinely zero).
- Leaderboard with fewer than 10 eligible students just shows what exists,
  no padding/placeholder rows.

## Testing

- Unit tests for the four `data/admin/analytics.ts` trend/day functions
  with mocked Supabase responses (edge cases: no data, single session
  spanning midnight — excluded/handled per existing dwell-time
  conventions, all-day-open session still checked in).
- Unit test for `getMonthlyLeaderboard` covering: opt-out filtering, tie
  handling (stable rank order), viewer-outside-top-10 rank injection.
- No new component/e2e tests beyond existing project conventions (this repo
  has no component test setup currently — matches existing pattern of
  data-layer-only unit tests).
