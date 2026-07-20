-- apps/database/supabase/migrations/20260720000100_financial_audit_and_refunds.sql
--
-- Two halves of the same problem: today the ONLY way to correct a financial
-- mistake is to destroy the record.
--
--   * `deleteSubscriptionAction` is exposed to the EMPLOYEE role and runs
--     through the service-role client, so it bypasses RLS entirely and leaves
--     no trace. A cashier can erase revenue and nothing records that it existed.
--   * A mis-rung POS sale cannot be corrected at all — `purchases` has no
--     UPDATE or DELETE policy and no reversal concept — so in practice staff
--     work around it, which is worse.
--
-- The fix is the standard accounting answer: records are append-only, and
-- corrections are new rows that reverse old ones. Every financial mutation is
-- journalled, and refunds become a first-class, audited operation available to
-- the staff who actually need it.

-- ---------------------------------------------------------------------------
-- 1. Financial audit journal
-- ---------------------------------------------------------------------------

CREATE TABLE public.financial_audit_log (
  id          uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  table_name  text NOT NULL,
  record_id   uuid NOT NULL,
  operation   text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  actor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role  text,
  before_data jsonb,
  after_data  jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX financial_audit_log_record_idx ON public.financial_audit_log (table_name, record_id);
CREATE INDEX financial_audit_log_created_idx ON public.financial_audit_log (created_at DESC);
CREATE INDEX financial_audit_log_actor_idx   ON public.financial_audit_log (actor_id);

ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;

-- Read-only to admins. No INSERT/UPDATE/DELETE policy exists for ANY role, so
-- the journal is unwritable and unerasable through PostgREST; only the
-- SECURITY DEFINER trigger below can append to it. An audit log that its own
-- users can edit is not an audit log.
CREATE POLICY "financial_audit_log_admin_read" ON public.financial_audit_log
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin');

CREATE OR REPLACE FUNCTION public.log_financial_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role  text;
BEGIN
  -- Best-effort: background jobs (pg_cron) have no auth.uid(), and the role
  -- lookup must never be the reason a legitimate write fails.
  BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = v_actor;
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  INSERT INTO public.financial_audit_log (
    table_name, record_id, operation, actor_id, actor_role, before_data, after_data
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE((to_jsonb(NEW) ->> 'id')::uuid, (to_jsonb(OLD) ->> 'id')::uuid),
    TG_OP,
    v_actor,
    v_role,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attached to every table that moves money. `purchase_items` is included
-- because a line-item edit changes COGS and margin without touching the header.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'expenses', 'subscriptions', 'purchases', 'purchase_items',
    'locker_payments', 'capital_movements', 'capital_transfers'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.log_financial_change()',
      'audit_' || t, t
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Refunds
-- ---------------------------------------------------------------------------

CREATE TYPE public.refund_source AS ENUM ('purchase', 'subscription', 'locker_payment');

CREATE TABLE public.refunds (
  id                uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  source            public.refund_source NOT NULL,
  purchase_id       uuid REFERENCES public.purchases(id) ON DELETE CASCADE,
  subscription_id   uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  locker_payment_id uuid REFERENCES public.locker_payments(id) ON DELETE CASCADE,
  amount_dt         numeric NOT NULL CHECK (amount_dt > 0),
  reason            text NOT NULL CHECK (length(trim(reason)) > 0),
  restocked         boolean NOT NULL DEFAULT false,
  created_by        uuid NOT NULL REFERENCES public.profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  -- Exactly one target, matching the declared source. Without this a refund
  -- row could point at nothing (invisible in every report) or at two things
  -- (double-counted).
  CONSTRAINT refunds_target_matches_source CHECK (
    (source = 'purchase'        AND purchase_id IS NOT NULL AND subscription_id IS NULL AND locker_payment_id IS NULL) OR
    (source = 'subscription'    AND subscription_id IS NOT NULL AND purchase_id IS NULL AND locker_payment_id IS NULL) OR
    (source = 'locker_payment'  AND locker_payment_id IS NOT NULL AND purchase_id IS NULL AND subscription_id IS NULL)
  )
);

CREATE INDEX refunds_purchase_idx     ON public.refunds (purchase_id);
CREATE INDEX refunds_subscription_idx ON public.refunds (subscription_id);
CREATE INDEX refunds_locker_idx       ON public.refunds (locker_payment_id);
CREATE INDEX refunds_created_at_idx   ON public.refunds (created_at);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refunds_staff_read" ON public.refunds
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('admin', 'employee'));

-- No INSERT/UPDATE/DELETE policies: refunds may only be created through the
-- RPCs below, which enforce the over-refund ceiling and handle restocking
-- atomically. A refund inserted directly could exceed the original amount and
-- turn a sale into net negative revenue.
CREATE TRIGGER audit_refunds
  AFTER INSERT OR UPDATE OR DELETE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.log_financial_change();

-- Total already refunded against one source row.
CREATE OR REPLACE FUNCTION public.refunded_total(p_source public.refund_source, p_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount_dt), 0)
  FROM public.refunds
  WHERE source = p_source
    AND CASE p_source
          WHEN 'purchase'       THEN purchase_id
          WHEN 'subscription'   THEN subscription_id
          WHEN 'locker_payment' THEN locker_payment_id
        END = p_id;
$$;

CREATE OR REPLACE FUNCTION public.refund_purchase(
  p_purchase_id uuid,
  p_amount      numeric,
  p_reason      text,
  p_restock     boolean DEFAULT true
)
RETURNS public.refunds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor    uuid := auth.uid();
  v_total    numeric;
  v_refunded numeric;
  v_refund   public.refunds;
  v_item     record;
BEGIN
  IF v_actor IS NULL OR public.current_user_role() NOT IN ('admin', 'employee') THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montant de remboursement invalide';
  END IF;

  SELECT total_dt INTO v_total FROM public.purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vente introuvable';
  END IF;

  v_refunded := public.refunded_total('purchase', p_purchase_id);
  IF v_refunded + p_amount > v_total THEN
    RAISE EXCEPTION 'Remboursement (%) supérieur au montant restant (%)',
      p_amount, v_total - v_refunded;
  END IF;

  -- Only a full refund returns stock: a partial refund cannot tell which of
  -- the basket's lines is being given back.
  IF p_restock AND (v_refunded + p_amount) = v_total THEN
    FOR v_item IN
      SELECT product_id, quantity FROM public.purchase_items WHERE purchase_id = p_purchase_id
    LOOP
      UPDATE public.products
         SET stock_quantity = stock_quantity + v_item.quantity
       WHERE id = v_item.product_id;
    END LOOP;
  END IF;

  INSERT INTO public.refunds (source, purchase_id, amount_dt, reason, restocked, created_by)
  VALUES ('purchase', p_purchase_id, p_amount, p_reason,
          p_restock AND (v_refunded + p_amount) = v_total, v_actor)
  RETURNING * INTO v_refund;

  RETURN v_refund;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refund_purchase(uuid, numeric, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.refund_subscription(
  p_subscription_id uuid,
  p_amount          numeric,
  p_reason          text,
  p_end_now         boolean DEFAULT true
)
RETURNS public.refunds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor    uuid := auth.uid();
  v_paid     numeric;
  v_refunded numeric;
  v_refund   public.refunds;
BEGIN
  IF v_actor IS NULL OR public.current_user_role() NOT IN ('admin', 'employee') THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montant de remboursement invalide';
  END IF;

  SELECT paid_amount INTO v_paid FROM public.subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Abonnement introuvable';
  END IF;

  v_refunded := public.refunded_total('subscription', p_subscription_id);
  IF v_refunded + p_amount > v_paid THEN
    RAISE EXCEPTION 'Remboursement (%) supérieur au montant restant (%)',
      p_amount, v_paid - v_refunded;
  END IF;

  -- Ending the membership is what a cancellation-with-refund means. The
  -- subscription row itself is preserved so the original sale stays on the
  -- books and the refund reverses it — rather than the sale vanishing.
  IF p_end_now THEN
    UPDATE public.subscriptions
       SET end_date = LEAST(end_date, (now() AT TIME ZONE 'Africa/Tunis')::date)
     WHERE id = p_subscription_id;
  END IF;

  INSERT INTO public.refunds (source, subscription_id, amount_dt, reason, created_by)
  VALUES ('subscription', p_subscription_id, p_amount, p_reason, v_actor)
  RETURNING * INTO v_refund;

  RETURN v_refund;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refund_subscription(uuid, numeric, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.refund_locker_payment(
  p_locker_payment_id uuid,
  p_amount            numeric,
  p_reason            text
)
RETURNS public.refunds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor    uuid := auth.uid();
  v_paid     numeric;
  v_refunded numeric;
  v_refund   public.refunds;
BEGIN
  IF v_actor IS NULL OR public.current_user_role() NOT IN ('admin', 'employee') THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montant de remboursement invalide';
  END IF;

  SELECT amount_dt INTO v_paid FROM public.locker_payments WHERE id = p_locker_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paiement de casier introuvable';
  END IF;

  v_refunded := public.refunded_total('locker_payment', p_locker_payment_id);
  IF v_refunded + p_amount > v_paid THEN
    RAISE EXCEPTION 'Remboursement (%) supérieur au montant restant (%)',
      p_amount, v_paid - v_refunded;
  END IF;

  INSERT INTO public.refunds (source, locker_payment_id, amount_dt, reason, created_by)
  VALUES ('locker_payment', p_locker_payment_id, p_amount, p_reason, v_actor)
  RETURNING * INTO v_refund;

  RETURN v_refund;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refund_locker_payment(uuid, numeric, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Close the silent-delete path
-- ---------------------------------------------------------------------------

-- 20260717010000 replaced `subscriptions_delete` with a version granting the
-- employee role DELETE, so mistakes could be undone. Refunds now cover that
-- need without destroying the record, so the destructive grant is withdrawn.
-- Admins keep it for genuine data-entry errors, and the audit trigger above
-- records those.
--
-- NOTE: this policy change alone is not sufficient. `deleteSubscriptionAction`
-- calls `createSupabaseAdminClient()`, and the service-role key bypasses RLS
-- entirely — the policy is not even consulted. The action itself is moved to
-- `adminActionClient` in the same change; this policy is defence in depth for
-- any other path that reaches the table.
DROP POLICY IF EXISTS "subscriptions_delete" ON public.subscriptions;

CREATE POLICY "subscriptions_delete" ON public.subscriptions
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 4. Revenue totals net of refunds
-- ---------------------------------------------------------------------------

-- Every all-time treasury figure must subtract what was handed back, or the
-- Caisse balance overstates by the full refund amount forever.
CREATE OR REPLACE FUNCTION public.analytics_capital_totals()
RETURNS TABLE (subs numeric, pos numeric, lockers numeric, expenses numeric, refunds numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  RETURN QUERY SELECT
    COALESCE((SELECT SUM(paid_amount) FROM public.subscriptions),   0),
    COALESCE((SELECT SUM(total_dt)    FROM public.purchases),       0),
    COALESCE((SELECT SUM(amount_dt)   FROM public.locker_payments), 0),
    COALESCE((SELECT SUM(amount_dt)   FROM public.expenses),        0),
    COALESCE((SELECT SUM(amount_dt)   FROM public.refunds),         0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_capital_totals() TO authenticated;

-- Period refund totals, split by stream so each revenue line can be shown
-- gross, less refunds, net.
CREATE OR REPLACE FUNCTION public.analytics_refunds(p_from date, p_to date)
RETURNS TABLE (subs numeric, pos numeric, lockers numeric, total numeric, refund_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lo timestamptz := (p_from::timestamp AT TIME ZONE 'Africa/Tunis');
  v_hi timestamptz := ((p_to + 1)::timestamp AT TIME ZONE 'Africa/Tunis');
BEGIN
  IF public.current_user_role() NOT IN ('admin', 'employee') THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(amount_dt) FILTER (WHERE source = 'subscription'), 0),
    COALESCE(SUM(amount_dt) FILTER (WHERE source = 'purchase'), 0),
    COALESCE(SUM(amount_dt) FILTER (WHERE source = 'locker_payment'), 0),
    COALESCE(SUM(amount_dt), 0),
    COUNT(*)::bigint
  FROM public.refunds
  WHERE created_at >= v_lo AND created_at < v_hi;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_refunds(date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
