# Owner Financial Cockpit — Admin Analytics Dashboard

**Date:** 2026-07-04
**Status:** Design approved for future implementation (not yet built)

## Purpose

Single admin-only analytics area whose primary job is an **owner financial cockpit**:
revenue, net profit, expenses, trends for weekly/monthly business-health review.
Money leads the page. Operational/live data is secondary. Secondary jobs
(subscriptions, POS, attendance, students, staff) get their own detail pages.

## Decisions (from brainstorm)

| Question | Decision |
|---|---|
| Primary purpose | Owner financial cockpit (financials lead) |
| Profit depth | **Full net profit**: Revenue (subs + POS) − COGS (`cost_price`) − all expenses |
| Recurring expenses | **Manual now, recurring later** — ship P&L on manual `expenses`; leave clean seam for a future `recurring_expenses` table + cron |
| Analytics sections kept | Subscriptions, POS/margin, Attendance/occupancy, Students & staff (all four) |
| student-category × product pivot | **Dropped** (niche for a cockpit; revisit later) |
| Live section | **Auto-refresh poll (~30s)** live strip |
| Layout | **Overview + detail pages** (most scalable) |

## Stack / conventions (existing repo)

- Next.js App Router, `apps/web`. Admin area `apps/web/src/app/admin`.
- Supabase Postgres. Data-fetch in `apps/web/src/data/admin/*` (server-only, server client).
  Mutations in `apps/web/src/actions/admin/*`.
- shadcn/ui + Recharts + Tailwind. **French UI, currency DT.**
- RLS: admin-only via `current_user_role() = 'admin'`. Heavy RPCs = SECURITY DEFINER,
  admin-guarded, following `pos_checkout` pattern. Migrations under
  `apps/database/supabase/migrations/`.
- **Reuse before adding.** Existing dashboard `apps/web/src/app/admin/dashboard/page.tsx`
  + `apps/web/src/data/admin/dashboard.ts` (`getLiveSnapshot`, `getDailySummary`,
  `getRevenueOverTime`, `getStudentTypeSeries`, `getPlanPopularity`, `getCustomMetrics`)
  and chart components `apps/web/src/components/admin/dashboard/*`. Accounting layer
  `apps/web/src/data/admin/accounting.ts` (`getPnl`, `getExpenses`, `getExpenseCategories`).

## Schema available (do NOT invent tables)

- `subscriptions` (student_id, plan_id, start_date, end_date, paid_amount, sold_by, created_at)
  + `subscription_plans` (name, duration_days, price_dt, is_active)
- `profiles` (role, full_name, university, study_level, is_archived, created_at)
  + `loyalty_ledger` (student_id, points_delta, reason)
- `attendance` (student_id, seat_id, room_id, checked_in_at, checked_out_at, entry_method)
- `purchases` (student_id, sold_by, total_dt) + `purchase_items` (product_id, quantity, unit_price_dt)
  + `products` (name, category, price_dt, cost_price, stock_quantity, supplier, barcode,
  account_category_id, is_active) + `product_categories`
- `pos_activity_log` (action, product_id, actor_id, quantity, amount_dt, details jsonb)
- `expenses` (account_category_id, description, amount_dt, date, created_by)
  + `account_categories` (type: income/expense, name)
- `custom_metrics` (name, unit, target_value, is_dashboard_visible)
- `shifts` (employee_id, start_time, end_time, role)

---

## Architecture

### Routing

- **`/admin/dashboard`** — Overview only. Live strip (auto-refresh 30s) + KPI tiles
  (period-over-period deltas) + net-profit headline + 2–3 summary charts. Every
  tile/chart links to its detail page.
- Detail pages:
  - **Finances → extend existing `/admin/accounting`** (already has P&L + expenses).
    No new route. Add net profit incl. COGS, revenue split subs/POS, expenses-by-category
    chart, daily cash-flow line.
  - `/admin/analytics/subscriptions`
  - `/admin/analytics/pos`
  - `/admin/analytics/attendance`
  - `/admin/analytics/students-staff`

### Global controls

- Date-range picker as URL search params, presets: today / 7d / 30d / this month /
  this quarter / custom. Shared across overview + all detail pages. Reuse accounting
  `DateRangeFilter`.

### Data layer

- Split `data/admin/dashboard.ts` → `data/admin/analytics/{overview,subscriptions,pos,attendance,students,staff}.ts`.
- Aggregate in SQL for heavy group-bys (margins, heatmap, COGS). New migration with
  SECURITY DEFINER + admin guard RPCs.
- Server components, `Promise.all` batching, `export const dynamic = 'force-dynamic'`.

---

## Net profit math (Finances)

```
revenue      = Σ subscriptions.paid_amount + Σ purchases.total_dt          (in range)
COGS         = Σ (purchase_items.quantity × products.cost_price)           (in range)
gross_margin = revenue − COGS
expenses     = Σ expenses.amount_dt                                        (in range)
net_profit   = gross_margin − expenses
```

- `cost_price` is nullable → treat NULL as 0 for COGS, flag products missing cost so
  margin isn't silently understated.
- Period-over-period: compute same window immediately preceding the selected range for
  delta arrows.

---

## Page contents

### Overview (`/admin/dashboard`)
- **Live strip** (auto-refresh 30s): present now (open attendance), seats occupied/total,
  today revenue, today transactions, low-stock count. Extend `getLiveSnapshot`.
- **KPI tiles** with Δ vs previous equal period: net profit, total revenue, gross margin,
  active subscriptions, new students, expenses.
- **Summary charts**: revenue over time (stacked subs vs POS), net cash-flow line.
- **Custom metrics**: visible `custom_metrics` as progress-to-target tiles.
- Each block links to its detail page.

### Finances (extend `/admin/accounting`)
- Net-profit summary card (formula above) + Δ.
- Revenue split subs vs POS (stacked bar over time).
- P&L table by `account_categories` (reuse `getPnl`).
- Expenses breakdown by category (donut/bar) + total.
- Daily cash-flow line (revenue − expenses).
- Keep existing expense entry + export. "Add expense" stays here.
- **Seam:** recurring expenses later — isolate expense posting so a future generator
  can insert rows without touching P&L queries.

### Subscriptions (`/admin/analytics/subscriptions`)
- Plan popularity (reuse `getPlanPopularity`).
- Active vs expiring-soon (end_date ≤ 7d) vs expired counts.
- Revenue per plan.
- Avg discount = plan `price_dt` − `paid_amount`.

### POS & products (`/admin/analytics/pos`)
- Best sellers (qty + revenue).
- Gross margin per product (`price_dt` − `cost_price`).
- Sales by category (drill category → products).
- Low-stock panel (reuse `LowStockPanel`).
- Restock history from `pos_activity_log` (action = restock).

### Attendance & occupancy (`/admin/analytics/attendance`)
- Current occupancy (occupied/total seats).
- Peak-hours heatmap (hour × weekday from `checked_in_at`) — RPC.
- Avg session duration (`checked_out_at` − `checked_in_at`).
- QR vs manual entry split.

### Students & staff (`/admin/analytics/students-staff`)
- New vs recurring over time (reuse `getStudentTypeSeries`).
- Breakdown by university and study_level.
- Top students by loyalty points and by spend.
- Per-employee revenue & transactions (`sold_by` on subscriptions + purchases).
- Shifts worked + sales-per-shift.

---

## Extensibility

- Each detail page = self-contained server component + its own data file. New section =
  one file + one route/link, no shared refactor.
- Expenses & custom metrics already admin-editable — surface "add expense" / "add metric"
  entry points.
- Recurring expenses, segment-buying pivot: deferred, seams left.

## Testing

- Each new RPC / data function: one runnable check (assert-based test or SQL test) per
  repo conventions. Priority: net-profit math and COGS aggregation (money paths).

## Deferred (YAGNI)

- `recurring_expenses` table + cron auto-posting.
- student-category × product buying-pattern pivot matrix.
