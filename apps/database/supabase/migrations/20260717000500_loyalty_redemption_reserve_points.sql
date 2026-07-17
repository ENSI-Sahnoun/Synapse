-- Fix race condition: two concurrent redemption requests could both pass the
-- balance check at creation time (points weren't deducted until admin fulfilment),
-- so an admin approving both could drive a student's point balance negative.
-- Fix: deduct points atomically at REQUEST time (advisory lock serializes concurrent
-- requests per student), and refund them if the request is later rejected/cancelled.

ALTER TABLE public.loyalty_redemption_requests
  DROP CONSTRAINT loyalty_redemption_requests_status_check;
ALTER TABLE public.loyalty_redemption_requests
  ADD CONSTRAINT loyalty_redemption_requests_status_check
  CHECK (status IN ('pending', 'fulfilled', 'rejected', 'cancelled'));

-- Atomic request creation: lock the student (advisory lock, released at transaction
-- end) so two concurrent requests from the same student can't both read a stale
-- balance, check it, insert the request, and deduct points immediately.
CREATE OR REPLACE FUNCTION public.request_redemption(p_rule_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid := auth.uid();
  v_rule    record;
  v_balance int;
  v_existing uuid;
  v_request_id uuid;
BEGIN
  IF public.current_user_role() <> 'student' THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_student::text));

  SELECT id, name, points_threshold, is_active INTO v_rule
    FROM public.loyalty_rules WHERE id = p_rule_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Récompense introuvable';
  END IF;
  IF NOT v_rule.is_active THEN
    RAISE EXCEPTION 'Cette récompense n''est plus disponible';
  END IF;

  SELECT id INTO v_existing
    FROM public.loyalty_redemption_requests
   WHERE student_id = v_student AND rule_id = p_rule_id AND status = 'pending'
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Une demande est déjà en attente pour cette récompense';
  END IF;

  SELECT COALESCE(SUM(points_delta), 0) INTO v_balance
    FROM public.loyalty_ledger WHERE student_id = v_student;

  IF v_balance < v_rule.points_threshold THEN
    RAISE EXCEPTION 'Solde insuffisant: % pts disponibles, % pts requis', v_balance, v_rule.points_threshold;
  END IF;

  INSERT INTO public.loyalty_redemption_requests (student_id, rule_id, status, points_used)
  VALUES (v_student, p_rule_id, 'pending', v_rule.points_threshold)
  RETURNING id INTO v_request_id;

  INSERT INTO public.loyalty_ledger (student_id, points_delta, reason, ref_id)
  VALUES (v_student, -v_rule.points_threshold, 'redemption', v_request_id);

  RETURN jsonb_build_object('id', v_request_id, 'rule_name', v_rule.name, 'points_used', v_rule.points_threshold);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_redemption(uuid) TO authenticated;

-- Points are now deducted at request time, so fulfilment no longer touches the
-- ledger — it only books the expense and flips the status.
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

-- Rejection now refunds the points that were reserved at request time.
CREATE OR REPLACE FUNCTION public.reject_redemption_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_req   record;
BEGIN
  IF public.current_user_role() NOT IN ('admin', 'employee') THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT r.id, r.student_id, r.points_used, r.status
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
  VALUES (v_req.student_id, v_req.points_used, 'redemption', p_request_id);

  UPDATE public.loyalty_redemption_requests
     SET status = 'rejected', handled_by = v_actor, handled_at = now()
   WHERE id = p_request_id;

  RETURN jsonb_build_object('student_id', v_req.student_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_redemption_request(uuid) TO authenticated;

-- Student cancellation of their own still-pending request — also refunds points.
CREATE OR REPLACE FUNCTION public.cancel_redemption_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid := auth.uid();
  v_req     record;
BEGIN
  SELECT r.id, r.student_id, r.points_used, r.status
    INTO v_req
    FROM public.loyalty_redemption_requests r
   WHERE r.id = p_request_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable';
  END IF;
  IF v_req.student_id <> v_student THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Cette demande a déjà été traitée';
  END IF;

  INSERT INTO public.loyalty_ledger (student_id, points_delta, reason, ref_id)
  VALUES (v_student, v_req.points_used, 'redemption', p_request_id);

  UPDATE public.loyalty_redemption_requests
     SET status = 'cancelled', handled_at = now()
   WHERE id = p_request_id;

  RETURN jsonb_build_object('points_used', v_req.points_used);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_redemption_request(uuid) TO authenticated;
