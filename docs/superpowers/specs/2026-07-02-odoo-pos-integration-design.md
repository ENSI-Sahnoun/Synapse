# Odoo POS Integration (Phase 1: Products + Purchases)

Date: 2026-07-02

## Problem

Synapse's custom POS (Phase 5D: products, purchases, purchase_items) is
functional but hand-rolled — basic per-item stock tracking, no barcode
support, no supplier/inventory workflows, and reporting is limited to
whatever custom charts get built. Rather than continuing to build catalogue
management, stock alerts, and per-category/per-item reporting by hand,
integrate a mature, free, self-hosted system (Odoo Community Edition) for
the parts that are generic retail/inventory concerns, while keeping
everything specific to Synapse's domain (students, subscriptions, seats,
attendance) untouched.

Subscriptions are explicitly out of scope for this phase — they're a
domain concept Odoo doesn't model natively, and migrating them is a
separate, larger project to consider later if this phase proves out.

## Goals

1. Product catalogue (name, price, category, stock) managed entirely in
   Odoo's own UI — retire Synapse's custom `ProductForm`/admin product
   pages.
2. Employees keep using Synapse's existing `/employee/pos` page
   (QR scan, cart, checkout) with zero UI change — checkout now records
   the sale in Odoo in addition to (not instead of) Synapse's own
   `purchases`/`purchase_items` tables.
3. Admin reporting (revenue per category/item, stock, date ranges) moves
   to Odoo's built-in POS/Sales reports — no custom chart code to
   maintain for this data.
4. A student who makes a purchase gets a matching customer record in
   Odoo (created lazily, on first purchase) so Odoo's reports can
   optionally be sliced by customer later.

Out of scope: subscriptions/subscription_plans migration, Odoo's own POS
screen (not used — Synapse's page is the only checkout UI employees see),
any Odoo module beyond Point of Sale + Inventory.

## Architecture

### Infrastructure

Odoo Community Edition, self-hosted via Docker, with its **own dedicated
Postgres instance** (not shared with the Supabase project database — the
local demo's reuse of the Supabase dev Postgres was a throwaway
convenience for exploration only, not the production pattern). Odoo
exposes its JSON-RPC/XML-RPC API on its internal port; Synapse's Next.js
server actions call it over the docker network (or an internal URL in
production).

### Identity mapping

New column `profiles.odoo_partner_id` (nullable int). Stays null until a
student's first purchase. At that point, the purchase action:
1. Checks `odoo_partner_id`; if null, calls Odoo's API to create a
   `res.partner` record (name from `profiles.full_name`), stores the
   returned id back on the profile.
2. Reuses the stored id for every subsequent purchase by that student.

Purchases with no `student_id` (walk-in/anonymous sales, already
supported by the nullable `purchases.student_id` column) skip partner
creation entirely and post to Odoo without a linked customer.

### Product catalogue

Odoo is the source of truth for products, categories, and stock level.
Synapse's `products` table changes role from writable catalogue to a
**read-only local cache**, refreshed by a periodic pull job (same cron
pattern as the existing `/api/notifications/process` route from Phase
6B): call Odoo's product API, upsert into `products` by a stored
`odoo_product_id` mapping column, mark any product no longer present in
Odoo as `is_active = false`.

This cache exists so `/employee/pos` can render a product list even if
Odoo is briefly unreachable. `ProductForm.tsx` and its admin
create/edit/delete server actions are deleted — product management
happens exclusively in Odoo's UI going forward.

### Sale flow

`/employee/pos` UI is unchanged. On checkout:

1. Write the purchase to `purchases`/`purchase_items` immediately (this
   remains the authoritative local transaction log employees and the
   rest of the app rely on). Add two columns to `purchases`:
   `sync_status` (`'pending' | 'synced' | 'failed'`, default `'pending'`)
   and `odoo_order_id` (nullable int).
2. Attempt to push the sale to Odoo synchronously in the same action:
   ensure/create the partner (see above), create a POS order with lines
   matching `purchase_items`, mark `sync_status = 'synced'` and store
   `odoo_order_id` on success.
3. On any failure calling Odoo (network error, timeout), catch it,
   leave `sync_status = 'pending'` — the sale is NOT rolled back or
   blocked from the employee's point of view.
4. A retry cron job (new route, same pattern as (C)'s cache pull) scans
   `purchases` where `sync_status = 'pending'`, retries pushing each to
   Odoo, and updates status. After a bounded number of retries
   (e.g. 5), mark `sync_status = 'failed'` and surface it in a simple
   admin-visible list (reuse existing admin table patterns) for manual
   follow-up — no automatic alerting beyond that.

### Reporting

Admin nav's product/sales reporting link points to Odoo's built-in
POS/Sales reporting UI (embedded iframe, matching the existing
`(admin-pages)` layout conventions) for per-category, per-item, and
date-range breakdowns. No new Synapse chart components for this data.

## Data Model Changes

- `profiles.odoo_partner_id` — nullable int, no default.
- `products.odoo_product_id` — nullable int, unique, used as the upsert
  key for the cache-pull job.
- `purchases.sync_status` — text, `'pending' | 'synced' | 'failed'`,
  not null default `'pending'`.
- `purchases.odoo_order_id` — nullable int.

No changes to `subscriptions`, `subscription_plans`, or any other table.

## Error Handling

- Odoo unreachable at checkout time: sale still records locally
  (`sync_status = 'pending'`), employee sees normal success, nothing
  blocks the register.
- Odoo unreachable during the cache-pull job: job is a no-op for that
  run, `products` table keeps its last-known state (stale but usable),
  logged but not surfaced to employees.
- Partner creation fails independently of the sale itself (e.g. Odoo
  reachable but partner API errors): the purchase itself still attempts
  to sync as an anonymous/no-partner Odoo order rather than failing the
  whole sync, so revenue reporting stays accurate even if customer-level
  attribution is temporarily missing for that one sale.
- Known accepted limitation: because sales can be recorded locally
  before Odoo confirms them, Odoo's stock count can briefly lag reality
  during an outage or backlog of pending syncs (e.g. two employees
  selling the last unit of something while Odoo is down). This mirrors
  the stock-race limitation already accepted in the current POS
  (Phase 5D progress log) — not a new regression, carried forward.

## Testing

Unit tests (mocked Odoo API responses, matching existing project
convention of data-layer-only tests):
- Lazy partner creation: first purchase creates+stores
  `odoo_partner_id`; subsequent purchases by the same student reuse it
  without a second create call.
- Sync-status transitions: pending → synced on success; pending stays
  pending on failure; retry job's bounded-retry → failed transition.
- Cache-pull job's upsert logic: new Odoo product creates a local row,
  removed Odoo product marks the local row `is_active = false`, existing
  product updates price/stock in place.
- Purchase-with-no-student_id skips partner creation and still syncs.
