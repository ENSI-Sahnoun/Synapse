# POS Overhaul Design

Date: 2026-07-03

## Problem

1. **Bug**: stock does not decrement on sale. Root cause: `apps/web/src/actions/employee/purchases.ts` does a client-side read-then-write `UPDATE products SET stock_quantity = ...` as the employee (non-admin) role. RLS policy `products_admin_all` (`apps/database/supabase/migrations/20260628100000_smp_products.sql:21-24`) only allows admins to UPDATE `products`. The employee's update matches 0 rows, Supabase returns no error on a 0-row update, so the sale completes but stock is untouched.
2. **No restock flow**: admins add stock by directly overwriting `stock_quantity` in the product edit form (blind overwrite, not additive), with no cost tracking and no link to expenses.
3. **No activity logging**: no record of sales, restocks, or product edits exists anywhere.
4. **Add-product UI**: minimal fields (name, category, price, stock_quantity, is_active, image), no cost tracking, no supplier/barcode.
5. **No expense linkage**: restocking inventory does not create a corresponding expense entry, even though an `expenses` table + accounting module already exist.

## Approach

Replace client-side read-then-write stock mutations with two atomic, `SECURITY DEFINER` Postgres RPC functions. This fixes the RLS bug at the root (function runs with elevated privilege regardless of caller's role), removes the read-then-write race condition (row-level lock via conditional `UPDATE`), and gives one choke point per operation to write activity-log rows.

## Schema changes

```sql
-- Product fields
alter table products add column cost_price numeric check (cost_price >= 0);
alter table products add column supplier text;
alter table products add column barcode text unique;

-- Activity log
create table pos_activity_log (
  id uuid primary key default extensions.uuid_generate_v4(),
  action text not null check (action in ('sale','restock','product_create','product_update')),
  product_id uuid references products(id),
  actor_id uuid not null references profiles(id),
  quantity int,
  amount_dt numeric,
  details jsonb,
  created_at timestamptz not null default now()
);
-- RLS: admin can select all rows; employees can select rows where actor_id = auth.uid()

-- New account category, seeded via migration
insert into account_categories (name, kind) values ('Achats stock', 'expense');
-- (exact columns to match existing account_categories table shape)
```

## RPC functions

### `pos_checkout(p_student_id uuid, p_items jsonb) returns jsonb`

- `SECURITY DEFINER`, runs as table owner (bypasses the admin-only RLS restriction on `products` intentionally, since it does its own validation).
- For each item: `UPDATE products SET stock_quantity = stock_quantity - qty WHERE id = product_id AND stock_quantity >= qty AND is_active RETURNING price_dt, name` — if 0 rows returned, raise exception naming the product (insufficient stock or inactive/missing). This is the atomic, race-safe stock decrement.
- Computes total server-side from returned `price_dt` values (never trusts client price).
- Inserts `purchases` + `purchase_items`.
- If `p_student_id` provided, inserts `loyalty_ledger` row (`points_delta = floor(total)`), non-fatal on failure (log to `details`, continue).
- Inserts one `pos_activity_log` row per item (`action = 'sale'`).
- Returns `{ purchase_id, total_dt, points_earned }`.
- Server action `createPurchaseAction` becomes a thin wrapper: validate input shape via zod, call `supabase.rpc('pos_checkout', ...)`, call `notifyAllStaff`, `revalidatePath`.

### `pos_restock(p_product_id uuid, p_quantity int, p_cost_price numeric, p_tax_rate_pct numeric default 19) returns jsonb`

- `SECURITY DEFINER`, admin-only (checks `current_user_role() = 'admin'` inside the function, raises otherwise — defense in depth even though the action layer also gates this).
- `UPDATE products SET stock_quantity = stock_quantity + p_quantity, cost_price = p_cost_price WHERE id = p_product_id` (additive, not overwrite).
- Computes `total = p_quantity * p_cost_price * (1 + p_tax_rate_pct / 100)`.
- Inserts `expenses` row: `account_category_id` = the `"Achats stock"` category, `description` = `'Réappro: <product name> x<qty>'`, `amount_dt = total`, `created_by = auth.uid()`.
- Inserts `pos_activity_log` row (`action = 'restock'`, `quantity`, `amount_dt = total`).
- Returns `{ new_stock_quantity, expense_id }`.

Product create/update actions (`actions/admin/products.ts`) additionally insert a `pos_activity_log` row (`action = 'product_create'` / `'product_update'`) after a successful write — plain insert from the existing server action, no RPC needed since these aren't concurrency-sensitive.

## UI changes

**Product form** (`ProductForm.tsx`): add `cost_price`, `supplier` (optional text), `barcode` (optional text) fields. Two-column layout. Live margin display (`price_dt - cost_price`) when both present. `stock_quantity` becomes **read-only display** on this form (no more direct overwrite) — a note points to the restock action instead.

**Restock dialog**: new component, triggered from product list (admin) and product edit page. Inputs: quantity to add, cost price (prefilled from product's current `cost_price`, editable), tax rate % (default 19). Shows computed total expense live before confirm. Calls `pos_restock` via a new server action `restockProductAction`.

**Activity log page**: `/admin/products/activity` — table of `pos_activity_log` joined to product name and actor name, filterable by action type and date range, admin-only, read-only.

**Checkout flow** (`pos-client.tsx`): no UX changes. Underlying action swaps to the RPC call; error surfacing (insufficient stock message etc.) stays the same shape.

## Out of scope

- App-wide generic audit log (only POS-scoped logging, per user decision).
- Editable/deletable activity log entries (append-only).
- Multi-currency or configurable default tax rate storage (hardcoded 19% default in the RPC signature, editable per restock).

## Testing

- RPC functions get direct SQL/pgTAP-style or integration test hitting Supabase local: verify concurrent restock calls sum correctly, verify checkout rejects overselling, verify checkout leaves activity log + expense rows.
- Manual verification: sell a product via POS UI, confirm `stock_quantity` decreases; restock a product, confirm `stock_quantity` sums, confirm an expense row appears in the accounting module under "Achats stock".
