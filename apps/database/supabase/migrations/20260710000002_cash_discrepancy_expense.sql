-- apps/database/supabase/migrations/20260710000002_cash_discrepancy_expense.sql
-- Cash session discrepancies (écart de caisse) affect real cash on hand, so
-- they must flow into the financial reports (P&L, net profit, cash flow),
-- not stay siloed in cash_register_sessions. On close, any non-zero
-- discrepancy is auto-posted to a dedicated "Écart de caisse" expense
-- category: a shortfall posts as a positive expense, a surplus posts as a
-- negative one (reduces total expenses / boosts net profit), reusing the
-- existing expenses table rather than adding a parallel income concept.

-- Fixed id (not the default uuid_generate_v4()) so the constraint below can
-- reference this exact system category without a subquery, which CHECK
-- constraints don't support.
INSERT INTO public.account_categories (id, type, name, description)
SELECT '00000000-0000-0000-0000-0000000000ec', 'expense', 'Écart de caisse',
       'Écarts constatés à la clôture des sessions de caisse (excédents/manques) — généré automatiquement, ne pas réutiliser'
WHERE NOT EXISTS (
  SELECT 1 FROM public.account_categories WHERE name = 'Écart de caisse'
);

-- Manual entries via the accounting UI still require a positive amount
-- (enforced by createExpenseSchema and, now, this constraint for every
-- category except the system-generated cash-discrepancy one below, which
-- pos_close_session (SECURITY DEFINER) can post as negative to represent a
-- cash surplus reducing total expenses).
ALTER TABLE public.expenses DROP CONSTRAINT expenses_amount_dt_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_amount_dt_check
  CHECK (amount_dt >= 0 OR account_category_id = '00000000-0000-0000-0000-0000000000ec');

CREATE OR REPLACE FUNCTION public.pos_close_session(
  p_session_id     uuid,
  p_closing_amount numeric,
  p_notes          text
)
RETURNS public.cash_register_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id  uuid := auth.uid();
  v_session   public.cash_register_sessions;
  v_movements_in  numeric := 0;
  v_movements_out numeric := 0;
  v_sales     numeric := 0;
  v_expected  numeric;
  v_discrepancy_category_id uuid;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT * INTO v_session
    FROM public.cash_register_sessions
   WHERE id = p_session_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session de caisse introuvable';
  END IF;

  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'La session de caisse est déjà clôturée';
  END IF;

  SELECT COALESCE(SUM(amount_dt), 0) INTO v_movements_in
    FROM public.cash_movements
   WHERE session_id = p_session_id AND type = 'in';

  SELECT COALESCE(SUM(amount_dt), 0) INTO v_movements_out
    FROM public.cash_movements
   WHERE session_id = p_session_id AND type = 'out';

  SELECT COALESCE(SUM(total_dt), 0) INTO v_sales
    FROM public.purchases
   WHERE created_at BETWEEN v_session.opened_at AND now();

  v_expected := v_session.opening_amount_dt + v_movements_in - v_movements_out + v_sales;

  UPDATE public.cash_register_sessions
     SET status             = 'closed',
         closed_by          = v_actor_id,
         closed_at          = now(),
         closing_amount_dt  = p_closing_amount,
         expected_amount_dt = v_expected,
         discrepancy_dt     = p_closing_amount - v_expected,
         notes              = p_notes
   WHERE id = p_session_id
   RETURNING * INTO v_session;

  IF v_session.discrepancy_dt <> 0 THEN
    SELECT id INTO v_discrepancy_category_id
      FROM public.account_categories
     WHERE name = 'Écart de caisse'
     LIMIT 1;

    INSERT INTO public.expenses (account_category_id, description, amount_dt, date, created_by)
    VALUES (
      v_discrepancy_category_id,
      'Écart de caisse — session clôturée le ' || to_char(v_session.closed_at, 'DD/MM/YYYY HH24:MI'),
      -v_session.discrepancy_dt,
      v_session.closed_at::date,
      v_actor_id
    );
  END IF;

  RETURN v_session;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_close_session(uuid, numeric, text) TO authenticated;
