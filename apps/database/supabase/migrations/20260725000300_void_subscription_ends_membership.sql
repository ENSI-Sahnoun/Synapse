-- pos_void_subscription (the "Annuler" action in the admin Journal) only ever
-- set voided_at/voided_by — it never touched end_date. Every access-control
-- query in the app (getActiveSubscription, check-in, reservations, etc.)
-- determines an active membership purely from end_date >= today and never
-- looks at voided_at, so a student voided from the Journal kept full access.
-- Cancelling from "Gérer l'abonnement" (updateSubscriptionAction) already
-- backdates end_date to end the membership — make voiding do the same, and
-- mark voided_at there too so both surfaces agree on what "cancelled" means
-- and the subscription history UI can show a single "Annulé" badge either
-- way it happened.

CREATE OR REPLACE FUNCTION public.pos_void_subscription(p_subscription_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id   uuid := auth.uid();
  v_student_id uuid;
  v_refunded   numeric;
  v_awarded    integer;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT student_id INTO v_student_id
    FROM public.subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Abonnement introuvable';
  END IF;
  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE id = p_subscription_id AND voided_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Abonnement déjà annulé';
  END IF;

  v_refunded := public.refunded_total('subscription', p_subscription_id);
  IF v_refunded > 0 THEN
    RAISE EXCEPTION 'Abonnement déjà partiellement ou totalement remboursé, annulation impossible';
  END IF;

  UPDATE public.subscriptions
     SET voided_at = now(),
         voided_by = v_actor_id,
         end_date  = LEAST(end_date, (now() AT TIME ZONE 'Africa/Tunis')::date - 1)
   WHERE id = p_subscription_id;

  SELECT COALESCE(SUM(points_delta), 0) INTO v_awarded
    FROM public.loyalty_ledger WHERE ref_id = p_subscription_id AND reason = 'subscription';
  IF v_awarded > 0 AND NOT EXISTS (
    SELECT 1 FROM public.loyalty_ledger
     WHERE ref_id = p_subscription_id AND reason = 'adjustment' AND points_delta < 0
  ) THEN
    INSERT INTO public.loyalty_ledger (student_id, points_delta, reason, ref_id)
    VALUES (v_student_id, -v_awarded, 'adjustment', p_subscription_id);
  END IF;

  INSERT INTO public.pos_activity_log (action, actor_id, subscription_id, details)
  VALUES ('subscription_void', v_actor_id, p_subscription_id, jsonb_build_object('subscription_id', p_subscription_id));

  RETURN jsonb_build_object('subscription_id', p_subscription_id, 'voided', true);
END;
$$;
