-- Reward redemptions book an expense (dépense) on fulfilment.

-- A) Editable per-rule cost booked to dépenses when the reward is redeemed.
ALTER TABLE public.loyalty_rules
  ADD COLUMN redemption_cost_dt numeric NOT NULL DEFAULT 0
    CHECK (redemption_cost_dt >= 0);

-- B) Dedicated expense category for redeemed rewards.
INSERT INTO public.account_categories (type, name, description)
SELECT 'expense', 'Récompenses fidélité', 'Coût des récompenses fidélité échangées'
WHERE NOT EXISTS (
  SELECT 1 FROM public.account_categories WHERE name = 'Récompenses fidélité'
);

-- C) Atomic fulfilment: deduct points, book expense, flip status — one transaction.
-- SECURITY DEFINER so employees (blocked by expenses RLS) can book the expense,
-- and to remove the previous non-atomic ledger/status race.
CREATE OR REPLACE FUNCTION public.fulfil_redemption(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor   uuid := auth.uid();
  v_req     record;
  v_cost    numeric;
  v_cat     uuid;
  v_expense uuid;
BEGIN
  IF public.current_user_role() NOT IN ('admin', 'employee') THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT r.id, r.student_id, r.points_used, r.status, r.rule_id
    INTO v_req
    FROM public.loyalty_redemption_requests r
   WHERE r.id = p_request_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Cette demande a déjà été traitée';
  END IF;

  INSERT INTO public.loyalty_ledger (student_id, points_delta, reason, ref_id)
  VALUES (v_req.student_id, -v_req.points_used, 'redemption', p_request_id);

  SELECT redemption_cost_dt INTO v_cost
    FROM public.loyalty_rules WHERE id = v_req.rule_id;

  IF COALESCE(v_cost, 0) > 0 THEN
    SELECT id INTO v_cat
      FROM public.account_categories WHERE name = 'Récompenses fidélité' LIMIT 1;
    INSERT INTO public.expenses (account_category_id, description, amount_dt, created_by)
    VALUES (v_cat, 'Récompense fidélité échangée', v_cost, v_actor)
    RETURNING id INTO v_expense;
  END IF;

  UPDATE public.loyalty_redemption_requests
     SET status = 'fulfilled', handled_by = v_actor, handled_at = now()
   WHERE id = p_request_id;

  RETURN jsonb_build_object('points_used', v_req.points_used, 'expense_id', v_expense);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fulfil_redemption(uuid) TO authenticated;
