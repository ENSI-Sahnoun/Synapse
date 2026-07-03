# POS Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix stock not decrementing on sale, add a real restock flow that logs expenses, add cost/supplier/barcode fields to products, and log every POS action (sale, restock, product create/update).

**Architecture:** Two new `SECURITY DEFINER` Postgres RPC functions (`pos_checkout`, `pos_restock`) replace client-side read-then-write stock mutations in `apps/web/src/actions/employee/purchases.ts`. This fixes the root-cause RLS bug (employee UPDATE on `products` silently matches 0 rows under policy `products_admin_all`), removes the read-then-write race condition via a conditional `UPDATE ... WHERE stock_quantity >= qty`, and centralizes activity logging into one new `pos_activity_log` table. Product edits and restocks also log to this table from the existing (non-RPC) server actions.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), next-safe-action, react-hook-form + zod, shadcn/ui components, Sonner toasts.

## Global Constraints

- Currency is DT (Tunisian Dinar), amounts stored as `numeric`.
- Default restock tax rate: 19% (editable per restock).
- All new/modified user-facing strings are French, matching existing app copy (see error messages in `purchases.ts`, labels in `ProductForm.tsx`).
- Migrations go in `apps/database/supabase/migrations/`, filename prefixed with a timestamp later than `20260703050000` (the latest existing migration).
- POS-only activity logging (no app-wide generic audit log) — out of scope per approved design.
- Do not modify `stock_quantity` via direct client `.update()` anywhere after this plan — all stock changes must go through `pos_checkout` or `pos_restock`.

---

### Task 1: Migration — product fields, activity log table, expense category

**Files:**
- Create: `apps/database/supabase/migrations/20260703060000_pos_overhaul_schema.sql`

**Interfaces:**
- Produces: `products.cost_price` (numeric, nullable), `products.supplier` (text, nullable), `products.barcode` (text, nullable, unique); table `public.pos_activity_log` with columns `id, action, product_id, actor_id, quantity, amount_dt, details, created_at`; new `account_categories` row named `'Achats stock'` (type `'expense'`).

- [ ] **Step 1: Write the migration file**

```sql
-- apps/database/supabase/migrations/20260703060000_pos_overhaul_schema.sql

ALTER TABLE public.products
  ADD COLUMN cost_price numeric CHECK (cost_price >= 0),
  ADD COLUMN supplier   text,
  ADD COLUMN barcode    text UNIQUE;

CREATE TABLE public.pos_activity_log (
  id         uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  action     text        NOT NULL CHECK (action IN ('sale', 'restock', 'product_create', 'product_update')),
  product_id uuid        REFERENCES public.products(id),
  actor_id   uuid        NOT NULL REFERENCES public.profiles(id),
  quantity   int,
  amount_dt  numeric,
  details    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pos_activity_log_created_at_idx ON public.pos_activity_log (created_at DESC);
CREATE INDEX pos_activity_log_product_id_idx ON public.pos_activity_log (product_id);

ALTER TABLE public.pos_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_activity_log_admin_select" ON public.pos_activity_log
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin');

CREATE POLICY "pos_activity_log_own_select" ON public.pos_activity_log
  FOR SELECT TO authenticated
  USING (actor_id = auth.uid());

-- No direct INSERT/UPDATE/DELETE policy: only SECURITY DEFINER functions
-- and server actions using the admin client write to this table.

INSERT INTO public.account_categories (type, name, description) VALUES
  ('expense', 'Achats stock', 'Réapprovisionnement de produits POS')
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Apply the migration locally**

Run: `cd apps/database && supabase db reset` (or `supabase migration up` if using a running local stack — check `apps/database/README.md` or existing scripts for the project's convention; if unsure, run `supabase db reset` since this is a local dev database).

Expected: migration applies with no errors; `\d products` shows `cost_price`, `supplier`, `barcode`; `\d pos_activity_log` shows the new table.

- [ ] **Step 3: Regenerate TypeScript types**

Run: `cd apps/web && npx supabase gen types typescript --local > src/lib/database.types.ts` (match whatever command is already used — check `package.json` scripts for a `gen:types` or similar script first and use that if present).

Expected: `src/lib/database.types.ts` now includes `cost_price`, `supplier`, `barcode` on `products` and a `pos_activity_log` table type.

- [ ] **Step 4: Commit**

```bash
git add apps/database/supabase/migrations/20260703060000_pos_overhaul_schema.sql apps/web/src/lib/database.types.ts
git commit -m "feat(db): add product cost/supplier/barcode, pos_activity_log table, Achats stock category"
```

---

### Task 2: Migration — `pos_checkout` RPC function

**Files:**
- Create: `apps/database/supabase/migrations/20260703060001_pos_checkout_function.sql`

**Interfaces:**
- Consumes: `products` table (`Task 1`), `purchases`, `purchase_items`, `loyalty_ledger` tables (pre-existing), `pos_activity_log` (`Task 1`).
- Produces: `public.pos_checkout(p_student_id uuid, p_items jsonb) RETURNS jsonb` — `p_items` is a JSON array of `{"product_id": "<uuid>", "quantity": <int>}`. Returns `{"purchase_id": "<uuid>", "total_dt": <numeric>, "points_earned": <int>}`. Raises an exception (caught by the caller as a Postgres error, surfaced via Supabase client as `error.message`) if any product is missing, inactive, or has insufficient stock — exception message format: `Stock insuffisant pour "<name>": <available> disponible(s), <requested> demandé(s)` (matches existing message in `purchases.ts:32-34`) or `Produit introuvable: <id>` / `Produit inactif: <name>`.

- [ ] **Step 1: Write the migration file**

```sql
-- apps/database/supabase/migrations/20260703060001_pos_checkout_function.sql

CREATE OR REPLACE FUNCTION public.pos_checkout(p_student_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id     uuid := auth.uid();
  v_purchase_id  uuid;
  v_total_dt     numeric := 0;
  v_points       int := 0;
  v_item         jsonb;
  v_product_id   uuid;
  v_quantity     int;
  v_price        numeric;
  v_name         text;
  v_is_active    boolean;
  v_new_stock    int;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Le panier est vide';
  END IF;

  -- Pre-validate existence/active/stock without mutating (fail fast, no partial decrements)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity   := (v_item->>'quantity')::int;

    SELECT price_dt, name, is_active, stock_quantity
      INTO v_price, v_name, v_is_active, v_new_stock
      FROM public.products WHERE id = v_product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produit introuvable: %', v_product_id;
    END IF;
    IF NOT v_is_active THEN
      RAISE EXCEPTION 'Produit inactif: %', v_name;
    END IF;
    IF v_new_stock < v_quantity THEN
      RAISE EXCEPTION 'Stock insuffisant pour "%": % disponible(s), % demandé(s)', v_name, v_new_stock, v_quantity;
    END IF;

    v_total_dt := v_total_dt + (v_price * v_quantity);
  END LOOP;

  INSERT INTO public.purchases (student_id, sold_by, total_dt)
  VALUES (p_student_id, v_actor_id, v_total_dt)
  RETURNING id INTO v_purchase_id;

  -- Atomic, race-safe decrement + line items + activity log per item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity   := (v_item->>'quantity')::int;

    UPDATE public.products
       SET stock_quantity = stock_quantity - v_quantity
     WHERE id = v_product_id AND stock_quantity >= v_quantity
     RETURNING price_dt, name INTO v_price, v_name;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuffisant pour le produit %, vente concurrente détectée', v_product_id;
    END IF;

    INSERT INTO public.purchase_items (purchase_id, product_id, quantity, unit_price_dt)
    VALUES (v_purchase_id, v_product_id, v_quantity, v_price);

    INSERT INTO public.pos_activity_log (action, product_id, actor_id, quantity, amount_dt, details)
    VALUES ('sale', v_product_id, v_actor_id, v_quantity, v_price * v_quantity, jsonb_build_object('purchase_id', v_purchase_id));
  END LOOP;

  IF p_student_id IS NOT NULL THEN
    v_points := floor(v_total_dt)::int;
    IF v_points > 0 THEN
      INSERT INTO public.loyalty_ledger (student_id, points_delta, reason, ref_id)
      VALUES (p_student_id, v_points, 'purchase', v_purchase_id);
    END IF;
  END IF;

  RETURN jsonb_build_object('purchase_id', v_purchase_id, 'total_dt', v_total_dt, 'points_earned', v_points);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_checkout(uuid, jsonb) TO authenticated;
```

- [ ] **Step 2: Apply migration**

Run: `cd apps/database && supabase db reset`
Expected: no errors; `\df pos_checkout` shows the function.

- [ ] **Step 3: Manual smoke test via SQL**

Run (in `supabase db` psql or SQL editor, replacing UUIDs with real ones from a local seed product and a staff profile):

```sql
select public.pos_checkout(null, '[{"product_id": "<existing-product-uuid>", "quantity": 1}]'::jsonb);
```

Expected: returns a jsonb object with `purchase_id`, `total_dt`, `points_earned`; re-querying `select stock_quantity from products where id = '<existing-product-uuid>'` shows it decreased by 1.

- [ ] **Step 4: Commit**

```bash
git add apps/database/supabase/migrations/20260703060001_pos_checkout_function.sql
git commit -m "feat(db): add pos_checkout RPC for atomic race-safe stock decrement"
```

---

### Task 3: Migration — `pos_restock` RPC function

**Files:**
- Create: `apps/database/supabase/migrations/20260703060002_pos_restock_function.sql`

**Interfaces:**
- Consumes: `products`, `expenses`, `pos_activity_log` tables, `account_categories` row `'Achats stock'` (`Task 1`).
- Produces: `public.pos_restock(p_product_id uuid, p_quantity int, p_cost_price numeric, p_tax_rate_pct numeric DEFAULT 19) RETURNS jsonb` — returns `{"new_stock_quantity": <int>, "expense_id": "<uuid>"}`. Raises exception if caller is not admin, quantity <= 0, or product not found.

- [ ] **Step 1: Write the migration file**

```sql
-- apps/database/supabase/migrations/20260703060002_pos_restock_function.sql

CREATE OR REPLACE FUNCTION public.pos_restock(
  p_product_id uuid,
  p_quantity int,
  p_cost_price numeric,
  p_tax_rate_pct numeric DEFAULT 19
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id   uuid := auth.uid();
  v_name       text;
  v_new_stock  int;
  v_total      numeric;
  v_category_id uuid;
  v_expense_id uuid;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès refusé: droits administrateur requis';
  END IF;
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantité invalide: %', p_quantity;
  END IF;
  IF p_cost_price < 0 THEN
    RAISE EXCEPTION 'Coût invalide: %', p_cost_price;
  END IF;

  UPDATE public.products
     SET stock_quantity = stock_quantity + p_quantity,
         cost_price = p_cost_price
   WHERE id = p_product_id
   RETURNING name, stock_quantity INTO v_name, v_new_stock;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit introuvable: %', p_product_id;
  END IF;

  v_total := p_quantity * p_cost_price * (1 + p_tax_rate_pct / 100);

  SELECT id INTO v_category_id FROM public.account_categories WHERE name = 'Achats stock' LIMIT 1;

  INSERT INTO public.expenses (account_category_id, description, amount_dt, created_by)
  VALUES (v_category_id, format('Réappro: %s x%s', v_name, p_quantity), v_total, v_actor_id)
  RETURNING id INTO v_expense_id;

  INSERT INTO public.pos_activity_log (action, product_id, actor_id, quantity, amount_dt, details)
  VALUES ('restock', p_product_id, v_actor_id, p_quantity, v_total,
          jsonb_build_object('cost_price', p_cost_price, 'tax_rate_pct', p_tax_rate_pct, 'expense_id', v_expense_id));

  RETURN jsonb_build_object('new_stock_quantity', v_new_stock, 'expense_id', v_expense_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_restock(uuid, int, numeric, numeric) TO authenticated;
```

- [ ] **Step 2: Apply migration**

Run: `cd apps/database && supabase db reset`
Expected: no errors; `\df pos_restock` shows the function.

- [ ] **Step 3: Manual smoke test via SQL**

Run:
```sql
select public.pos_restock('<existing-product-uuid>', 20, 1.5, 19);
```
Expected: returns jsonb with `new_stock_quantity` and `expense_id`; `select * from expenses order by created_at desc limit 1` shows the new row with `amount_dt = 20 * 1.5 * 1.19 = 35.7`.

- [ ] **Step 4: Commit**

```bash
git add apps/database/supabase/migrations/20260703060002_pos_restock_function.sql
git commit -m "feat(db): add pos_restock RPC (additive stock + auto expense entry)"
```

---

### Task 4: Wire `pos_checkout` into the checkout server action

**Files:**
- Modify: `apps/web/src/actions/employee/purchases.ts`
- Test: manual (no existing test suite for server actions in this repo — verify via Task 8 UI smoke test)

**Interfaces:**
- Consumes: `public.pos_checkout(uuid, jsonb)` RPC (`Task 2`).
- Produces: `createPurchaseAction` still returns `{ purchaseId, total_dt, pointsEarned, studentLinked }` (unchanged shape, so `pos-client.tsx` needs no changes).

- [ ] **Step 1: Replace the manual insert/update logic with the RPC call**

```ts
'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { createPurchaseSchema } from '@/utils/zod-schemas/purchase'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'
import { notifyAllStaff } from '@/data/notifications/inapp'

export const createPurchaseAction = employeeActionClient
  .schema(createPurchaseSchema)
  .action(async ({ parsedInput }) => {
    const { student_id, items } = parsedInput
    const supabase = await createSupabaseClient()

    const { data, error } = await supabase.rpc('pos_checkout', {
      p_student_id: student_id ?? null,
      p_items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
    })

    if (error) throw new Error(error.message)

    const result = data as { purchase_id: string; total_dt: number; points_earned: number }

    try {
      await notifyAllStaff(
        'purchase_completed',
        `Vente enregistrée : ${result.total_dt.toFixed(2)} DT${student_id ? ' (étudiant lié)' : ''}.`,
      )
    } catch { /* non-fatal */ }

    revalidatePath('/employee/pos')
    return {
      purchaseId: result.purchase_id,
      total_dt: result.total_dt,
      pointsEarned: result.points_earned,
      studentLinked: !!student_id,
    }
  })
```

- [ ] **Step 2: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors from `purchases.ts` (the `supabase.rpc` call may need a cast if `database.types.ts` doesn't yet declare `pos_checkout` in its `Functions` map — if so, cast the rpc call's return with `as { purchase_id: string; total_dt: number; points_earned: number }` after `.rpc('pos_checkout' as any, ...)` only if strictly necessary; prefer regenerating types from Task 1 Step 3 first).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/actions/employee/purchases.ts
git commit -m "fix(pos): checkout now calls atomic pos_checkout RPC, fixing stock not decrementing"
```

---

### Task 5: Restock server action + zod schema

**Files:**
- Create: `apps/web/src/utils/zod-schemas/restock.ts`
- Modify: `apps/web/src/actions/admin/products.ts`

**Interfaces:**
- Consumes: `public.pos_restock(uuid, int, numeric, numeric)` RPC (`Task 3`).
- Produces: `restockProductSchema` (zod), `restockProductAction` returning `{ newStockQuantity: number, expenseId: string }`.

- [ ] **Step 1: Write the zod schema**

```ts
// apps/web/src/utils/zod-schemas/restock.ts
import { z } from 'zod'

export const restockProductSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1, 'Quantité minimum 1'),
  cost_price: z.coerce.number().min(0, 'Coût invalide'),
  tax_rate_pct: z.coerce.number().min(0).max(100).default(19),
})

export type RestockInput = z.infer<typeof restockProductSchema>
```

- [ ] **Step 2: Add the server action**

Add to `apps/web/src/actions/admin/products.ts` (after the existing `restoreProductAction`, before `deleteProductAction`):

```ts
import { restockProductSchema } from '@/utils/zod-schemas/restock'
import { createSupabaseClient } from '@/supabase-clients/server'

export const restockProductAction = adminActionClient
  .schema(restockProductSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { data, error } = await supabase.rpc('pos_restock', {
      p_product_id: parsedInput.product_id,
      p_quantity: parsedInput.quantity,
      p_cost_price: parsedInput.cost_price,
      p_tax_rate_pct: parsedInput.tax_rate_pct,
    })
    if (error) throw new Error(error.message)
    const result = data as { new_stock_quantity: number; expense_id: string }
    revalidatePath('/admin/products')
    revalidatePath('/admin/accounting')
    return { newStockQuantity: result.new_stock_quantity, expenseId: result.expense_id }
  })
```

Note: `apps/web/src/actions/admin/products.ts` currently imports `createSupabaseAdminClient` from `@/supabase-clients/admin` for other actions — add the `createSupabaseClient` import (from `@/supabase-clients/server`) alongside it since `pos_restock` relies on `auth.uid()` inside the function (the admin client bypasses auth context, so it must use the regular server client that carries the user's session).

- [ ] **Step 3: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/utils/zod-schemas/restock.ts apps/web/src/actions/admin/products.ts
git commit -m "feat(pos): add restockProductAction calling pos_restock RPC"
```

---

### Task 6: Add product create/update activity logging

**Files:**
- Modify: `apps/web/src/actions/admin/products.ts`

**Interfaces:**
- Consumes: `pos_activity_log` table (`Task 1`), `getLoggedInUserProfile` (already available via `adminActionClient` ctx as `ctx.userId`).
- Produces: no new exports; `createProductAction` and `updateProductAction` now also insert a `pos_activity_log` row.

- [ ] **Step 1: Update `createProductAction` and `updateProductAction`**

```ts
export const createProductAction = adminActionClient
  .schema(createProductSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase.from('products').insert(parsedInput).select('id').single()
    if (error) throw new Error('Erreur lors de la création du produit')
    await supabase.from('pos_activity_log').insert({
      action: 'product_create',
      product_id: data.id,
      actor_id: ctx.userId,
      details: parsedInput,
    })
    revalidatePath('/admin/products')
    return { success: true }
  })

export const updateProductAction = adminActionClient
  .schema(updateProductSchema)
  .action(async ({ parsedInput: { id, ...updates }, ctx }) => {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('products').update(updates).eq('id', id)
    if (error) throw new Error('Erreur lors de la mise à jour du produit')
    await supabase.from('pos_activity_log').insert({
      action: 'product_update',
      product_id: id,
      actor_id: ctx.userId,
      details: updates,
    })
    revalidatePath('/admin/products')
    return { success: true }
  })
```

(`createSupabaseAdminClient` uses the service role, bypassing RLS — fine here since `pos_activity_log` has no INSERT policy for regular users; this admin client is the one exception allowed to write directly, matching how it already writes `products` in this file.)

- [ ] **Step 2: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/actions/admin/products.ts
git commit -m "feat(pos): log product create/update to pos_activity_log"
```

---

### Task 7: Product form — cost price, supplier, barcode fields; remove direct stock editing

**Files:**
- Modify: `apps/web/src/utils/zod-schemas/product.ts`
- Modify: `apps/web/src/components/admin/products/ProductForm.tsx`
- Modify: `apps/web/src/data/admin/products.ts` (add new fields to `AdminProduct` interface and select)

**Interfaces:**
- Consumes: `restockProductAction` (`Task 5`), `restockProductSchema` (`Task 5`).
- Produces: `AdminProduct` type gains `cost_price: number | null`, `supplier: string | null`, `barcode: string | null`.

- [ ] **Step 1: Update `AdminProduct` and query**

```ts
// apps/web/src/data/admin/products.ts
export interface AdminProduct {
  id: string
  name: string
  category: string
  price_dt: number
  cost_price: number | null
  supplier: string | null
  barcode: string | null
  stock_quantity: number
  is_active: boolean
  image_url: string | null
  created_at: string
}

export async function listAllProducts(): Promise<AdminProduct[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .select('id, name, category, price_dt, cost_price, supplier, barcode, stock_quantity, is_active, image_url, created_at')
    .order('category', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw new Error('Erreur de chargement des produits')
  return data ?? []
}

export async function getProductById(id: string): Promise<AdminProduct | null> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .select('id, name, category, price_dt, cost_price, supplier, barcode, stock_quantity, is_active, image_url, created_at')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}
```

- [ ] **Step 2: Update zod schemas — add fields, drop `stock_quantity` from create/update (stock now only changes via restock/checkout)**

```ts
// apps/web/src/utils/zod-schemas/product.ts
import { z } from 'zod'

export const createProductSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(100),
  category: z.string().min(1, 'Catégorie requise').max(50),
  price_dt: z.coerce.number().min(0, 'Prix invalide'),
  cost_price: z.coerce.number().min(0, 'Coût invalide').nullable().optional(),
  supplier: z.string().max(100).nullable().optional(),
  barcode: z.string().max(64).nullable().optional(),
  image_url: z.string().url().nullable().optional(),
})

export const updateProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  category: z.string().min(1).max(50).optional(),
  price_dt: z.coerce.number().min(0).optional(),
  cost_price: z.coerce.number().min(0).nullable().optional(),
  supplier: z.string().max(100).nullable().optional(),
  barcode: z.string().max(64).nullable().optional(),
  is_active: z.boolean().optional(),
  image_url: z.string().url().nullable().optional(),
})

export const productIdSchema = z.object({ id: z.string().uuid() })

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
```

Note: `products.stock_quantity` in the DB retains its `DEFAULT 0` for new inserts (a new product starts with 0 stock; admin restocks it after creation via the restock dialog from Task 8). No app code sets `stock_quantity` directly on insert.

- [ ] **Step 3: Update `ProductForm.tsx`** — add cost/supplier/barcode inputs, replace the stock input with a read-only display + link/button to restock

Replace the "Stock" block (lines 237–244 in the current file) and the default values block, and add new fields after "Price":

```tsx
// In defaultValues (isEdit branch), add:
          cost_price: product.cost_price ?? undefined,
          supplier: product.supplier ?? undefined,
          barcode: product.barcode ?? undefined,
// (remove stock_quantity from defaultValues entirely — it's no longer a form field)
```

```tsx
{/* Cost price */}
<div className="space-y-1">
  <Label>Coût d&apos;achat (DT)</Label>
  <Input type="number" step="0.1" min="0" {...form.register('cost_price')} placeholder="ex: 0.8" />
  {form.formState.errors.cost_price && (
    <p className="text-sm text-destructive">{(form.formState.errors.cost_price as any).message}</p>
  )}
  {form.watch('price_dt') > 0 && Number(form.watch('cost_price')) > 0 && (
    <p className="text-xs text-muted-foreground">
      Marge: {(Number(form.watch('price_dt')) - Number(form.watch('cost_price'))).toFixed(3)} DT
    </p>
  )}
</div>

{/* Supplier */}
<div className="space-y-1">
  <Label>Fournisseur</Label>
  <Input {...form.register('supplier')} placeholder="ex: Grossiste Ariana" />
</div>

{/* Barcode */}
<div className="space-y-1">
  <Label>Code-barres</Label>
  <Input {...form.register('barcode')} placeholder="ex: 6191234567890" />
</div>

{/* Stock (read-only, restock happens via dedicated action) */}
{isEdit && (
  <div className="space-y-1">
    <Label>Stock actuel</Label>
    <p className="text-sm">{product.stock_quantity} unité(s)</p>
    <p className="text-xs text-muted-foreground">
      Utilisez le bouton &quot;Réapprovisionner&quot; sur la page produits pour ajouter du stock.
    </p>
  </div>
)}
```

- [ ] **Step 4: Type-check and manually verify the form**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors.

Run dev server (`npm run dev` in `apps/web`), navigate to `/admin/products/new` and an existing product's edit page, confirm cost/supplier/barcode fields render and submit correctly, confirm stock shows read-only on edit.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/utils/zod-schemas/product.ts apps/web/src/components/admin/products/ProductForm.tsx apps/web/src/data/admin/products.ts
git commit -m "feat(pos): add cost price/supplier/barcode fields, make stock read-only in product form"
```

---

### Task 8: Restock dialog component + wire into products page

**Files:**
- Create: `apps/web/src/components/admin/products/RestockDialog.tsx`
- Modify: `apps/web/src/app/admin/products/page.tsx` (render the dialog per product row)

**Interfaces:**
- Consumes: `restockProductAction`, `restockProductSchema` (`Task 5`), `AdminProduct` (`Task 7`).
- Produces: `RestockDialog` component, props `{ product: AdminProduct }`.

- [ ] **Step 1: Check existing dialog primitives in use**

Run: `grep -rn "from '@/components/ui/dialog'" apps/web/src | head -5` to confirm the shadcn `Dialog` component path and usage pattern already in the codebase; follow that exact import/usage pattern (props like `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`).

- [ ] **Step 2: Write the component**

```tsx
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { restockProductSchema, type RestockInput } from '@/utils/zod-schemas/restock'
import { restockProductAction } from '@/actions/admin/products'
import type { AdminProduct } from '@/data/admin/products'

export function RestockDialog({ product }: { product: AdminProduct }) {
  const [open, setOpen] = useState(false)

  const form = useForm<RestockInput>({
    resolver: zodResolver(restockProductSchema),
    defaultValues: {
      product_id: product.id,
      quantity: 1,
      cost_price: product.cost_price ?? 0,
      tax_rate_pct: 19,
    },
  })

  const { execute, status } = useAction(restockProductAction, {
    onSuccess: ({ data }) => {
      toast.success(`Stock mis à jour: ${data?.newStockQuantity} unité(s)`)
      setOpen(false)
      form.reset()
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const quantity = form.watch('quantity') || 0
  const costPrice = form.watch('cost_price') || 0
  const taxRate = form.watch('tax_rate_pct') ?? 19
  const total = quantity * costPrice * (1 + taxRate / 100)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Réapprovisionner
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Réapprovisionner: {product.name}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((d) => execute(d))}
          className="space-y-4"
        >
          <div className="space-y-1">
            <Label>Quantité ajoutée</Label>
            <Input type="number" min="1" {...form.register('quantity')} />
            {form.formState.errors.quantity && (
              <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Coût unitaire (DT, hors taxe)</Label>
            <Input type="number" step="0.1" min="0" {...form.register('cost_price')} />
            {form.formState.errors.cost_price && (
              <p className="text-sm text-destructive">{form.formState.errors.cost_price.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>TVA (%)</Label>
            <Input type="number" step="1" min="0" max="100" {...form.register('tax_rate_pct')} />
          </div>
          <p className="text-sm text-muted-foreground">
            Total dépense: {total.toFixed(3)} DT
          </p>
          <Button type="submit" disabled={status === 'executing'}>
            {status === 'executing' ? 'Enregistrement...' : 'Confirmer'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Add the dialog to the products list page**

Read `apps/web/src/app/admin/products/page.tsx` first to find the row-rendering loop, then add `<RestockDialog product={product} />` next to each product's edit/archive action buttons (follow whatever button-grouping layout already exists there).

- [ ] **Step 4: Manual verification**

Run dev server, go to `/admin/products`, click "Réapprovisionner" on a product, enter quantity 10, cost 2, tax 19, confirm total shows `23.800 DT`, submit, confirm success toast shows new stock, confirm the product's stock increased by 10 (check `/admin/products` list or edit page), and confirm a new expense row appears at `/admin/accounting` under "Achats stock".

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/admin/products/RestockDialog.tsx apps/web/src/app/admin/products/page.tsx
git commit -m "feat(pos): add restock dialog to products page"
```

---

### Task 9: POS checkout end-to-end verification

**Files:** none (verification only)

**Interfaces:**
- Consumes: everything from Tasks 1–8.

- [ ] **Step 1: Manual smoke test — sale decrements stock**

Run dev server. Log in as an employee (not admin). Go to `/employee/pos`. Note a product's current stock (check via admin products page in another tab, or the low-stock panel). Add it to cart, complete a sale without a linked student. Confirm success toast. Re-check the product's stock — it must have decreased by the sold quantity. This directly verifies the original bug is fixed.

- [ ] **Step 2: Manual smoke test — overselling is rejected**

Attempt to add more of a product to the cart than its current stock, or (if UI prevents that) call `createPurchaseAction` for a quantity exceeding stock via two rapid concurrent tabs to confirm the second request fails with the "Stock insuffisant" message rather than allowing negative stock.

- [ ] **Step 3: Manual smoke test — activity log has entries**

Run `select * from pos_activity_log order by created_at desc limit 10;` in the local SQL editor after Steps 1 and the Task 8 restock test. Confirm rows exist for `action = 'sale'` and `action = 'restock'` with correct `product_id`, `actor_id`, `quantity`, `amount_dt`.

- [ ] **Step 4: Run full type-check across the app**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Final commit if any fixes were needed during verification**

```bash
git add -A
git commit -m "fix(pos): address issues found during end-to-end verification"
```

(Skip this commit if verification found nothing to fix.)
