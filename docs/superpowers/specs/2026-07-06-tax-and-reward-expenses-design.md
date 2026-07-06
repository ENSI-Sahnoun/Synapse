# TAX rename, subscription tax & reward expenses — Design

Date: 2026-07-06

## Goal

Three related admin/accounting changes:

1. Rename the visible "TVA" label to "TAX".
2. Let admins set a TAX rate per subscription plan, added on top of the price at sale time.
3. When a student redeems a reward with points, record it as an expense (dépense). Admins set an editable per-reward cost that is deducted (booked to dépenses) on fulfilment.

## Context (current state)

- Only literal "TVA" in source: `apps/web/src/components/admin/products/RestockDialog.tsx:74` (`<Label>TVA (%)</Label>`). Field is `tax_rate_pct`. Restock already books an expense via `pos_restock` RPC.
- `subscription_plans` columns: `name, duration_days, price_dt, is_active`. No tax.
- Subscription sale (`createSubscriptionAction`) stores `paid_amount = price_dt`; loyalty points = `floor(price_dt)`. Revenue analytics sum `paid_amount`.
- `loyalty_rules`: `name, reward_type, points_threshold, reward_value, is_active`.
- Reward fulfilment (`fulfilRedemptionAction`, employee client) does 3 non-atomic steps: insert point-deduction ledger row, update request to `fulfilled`, notify. No expense recorded. Code has a documented ledger/status race.
- `expenses` table: `account_category_id, description, amount_dt, date, created_by`. RLS `expenses_insert` allows **admin only** — an employee cannot insert directly.
- `account_categories`: seeded income/expense rows.
- `apps/web/src/lib/database.types.ts` is hand-maintained (Supabase not linked); new columns must be added there. Real migrations live in `apps/database/supabase/migrations/`.

## Decisions

- Subscription tax: **per-plan rate, added on top**. `paid_amount = price_dt × (1 + tax_rate_pct/100)`.
- Loyalty points on sale: **pre-tax** — stays `floor(price_dt)`.
- Reward expense: **new `Récompenses fidélité` expense category**, amount = per-rule `redemption_cost_dt`.
- Zero-cost reward: **skip** the expense insert (no 0 DT rows).
- Rename: **UI label only**; keep `tax_rate_pct` identifiers/columns.

## Changes

### Feature 1 — TVA → TAX (UI only)

- `RestockDialog.tsx:74`: `TVA (%)` → `TAX (%)`.

### Feature 2 — Subscription TAX

**DB migration** (new file in `apps/database/supabase/migrations/`):
```sql
ALTER TABLE public.subscription_plans
  ADD COLUMN tax_rate_pct numeric NOT NULL DEFAULT 0
    CHECK (tax_rate_pct >= 0 AND tax_rate_pct <= 100);
```

**Schema** `utils/zod-schemas/subscription-plan.ts`: add
`tax_rate_pct: z.coerce.number().min(0).max(100).default(0)` to `createSubscriptionPlanSchema`
(propagates to `update...partial()`).

**Forms**:
- New plan page (`app/admin/subscription-plans/new/page.tsx`): add `TAX (%)` input, default 0.
- `EditPlanForm.tsx`: add `tax_rate_pct` to `FormValues`, `EditPlanFormProps.plan`, defaults, and a `TAX (%)` input.
- Edit route loader: ensure `tax_rate_pct` selected/passed into `EditPlanForm`.

**Sale** `actions/employee/subscriptions.ts`:
- Select `tax_rate_pct` alongside plan fields.
- `const paid = Number((plan.price_dt * (1 + (plan.tax_rate_pct ?? 0) / 100)).toFixed(3))`; store as `paid_amount`.
- Points unchanged: `Math.floor(plan.price_dt)`.

**Types**: add `tax_rate_pct: number` to `subscription_plans` Row/Insert(optional)/Update in `database.types.ts`.

### Feature 3 — Reward → dépense with editable cost

**DB migration A**:
```sql
ALTER TABLE public.loyalty_rules
  ADD COLUMN redemption_cost_dt numeric NOT NULL DEFAULT 0
    CHECK (redemption_cost_dt >= 0);
```

**DB migration B** — seed category (idempotent):
```sql
INSERT INTO public.account_categories (type, name, description)
SELECT 'expense', 'Récompenses fidélité', 'Coût des récompenses fidélité échangées'
WHERE NOT EXISTS (
  SELECT 1 FROM public.account_categories WHERE name = 'Récompenses fidélité'
);
```

**DB migration C** — atomic SECURITY DEFINER fulfilment RPC (mirrors `pos_restock`):
```sql
CREATE OR REPLACE FUNCTION public.fulfil_redemption(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_req record;
  v_cost numeric;
  v_cat uuid;
  v_expense uuid;
BEGIN
  IF public.current_user_role() NOT IN ('admin','employee') THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT r.id, r.student_id, r.points_used, r.status, r.rule_id
    INTO v_req
    FROM public.loyalty_redemption_requests r
   WHERE r.id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Demande déjà traitée'; END IF;

  INSERT INTO public.loyalty_ledger (student_id, points_delta, reason, ref_id)
  VALUES (v_req.student_id, -v_req.points_used, 'redemption', p_request_id);

  SELECT redemption_cost_dt INTO v_cost FROM public.loyalty_rules WHERE id = v_req.rule_id;
  IF COALESCE(v_cost, 0) > 0 THEN
    SELECT id INTO v_cat FROM public.account_categories WHERE name = 'Récompenses fidélité' LIMIT 1;
    INSERT INTO public.expenses (account_category_id, description, amount_dt, created_by)
    VALUES (v_cat, 'Récompense fidélité échangée', v_cost, v_actor)
    RETURNING id INTO v_expense;
  END IF;

  UPDATE public.loyalty_redemption_requests
     SET status = 'fulfilled', handled_by = v_actor, handled_at = now()
   WHERE id = p_request_id;

  RETURN jsonb_build_object('points_used', v_req.points_used, 'expense_id', v_expense);
END; $$;

GRANT EXECUTE ON FUNCTION public.fulfil_redemption(uuid) TO authenticated;
```
This fixes both the RLS block (employee inserting into `expenses`) and the existing non-atomic ledger/status race.

**Action** `actions/employee/loyalty-requests.ts`:
- Replace the three inline steps of `fulfilRedemptionAction` with a single `supabase.rpc('fulfil_redemption', { p_request_id: request_id })`; on error throw the message. Then send the existing `loyalty_fulfilled` notification (points from RPC result). `rejectRedemptionAction` unchanged.

**Schema** `utils/zod-schemas/loyalty-rule.ts`: add
`redemption_cost_dt: z.coerce.number().min(0, 'Coût invalide').default(0)`.

**Dialog** `app/admin/loyalty/loyalty-rule-dialog.tsx`:
- Add `redemption_cost_dt` to `LoyaltyRule` type and to create/edit `defaultValues`.
- Add an always-visible `Coût récompense (DT)` numeric input (`step 0.1`, min 0).

**Loyalty page** (`app/admin/loyalty/page.tsx`): select and pass `redemption_cost_dt` into each edit dialog.

**Types**: add `redemption_cost_dt: number` to `loyalty_rules` Row/Insert(optional)/Update in `database.types.ts`.

## Testing

- `subscription-plan.test.ts`: tax_rate_pct default 0, bounds 0–100.
- `loyalty-rule.test.ts`: redemption_cost_dt default 0, rejects negatives.
- `employee/subscriptions.test.ts`: `paid_amount` = price×(1+tax/100), rounded 3dp; points still floor(price).
- `employee/loyalty-requests.test.ts`: fulfil calls `fulfil_redemption` RPC; success path notifies; rejects double-handle.

## Out of scope

- Renaming `tax_rate_pct` DB columns/identifiers.
- Retroactive tax on existing subscriptions.
- Displaying tax breakdown in analytics/P&L (paid_amount already tax-inclusive going forward).
