-- apps/database/supabase/migrations/20260710000001_cash_register_functions.sql
-- SECURITY DEFINER functions for the caisse réelle feature, mirroring the
-- pos_checkout style in 20260703060001_pos_checkout_function.sql.

CREATE OR REPLACE FUNCTION public.pos_open_session(p_opening_amount numeric)
RETURNS public.cash_register_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_session  public.cash_register_sessions;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  IF EXISTS (SELECT 1 FROM public.cash_register_sessions WHERE status = 'open') THEN
    RAISE EXCEPTION 'Une session de caisse est déjà ouverte';
  END IF;

  INSERT INTO public.cash_register_sessions (opened_by, opening_amount_dt)
  VALUES (v_actor_id, p_opening_amount)
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_open_session(numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.pos_add_cash_movement(
  p_session_id uuid,
  p_type       text,
  p_amount     numeric,
  p_reason     text
)
RETURNS public.cash_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_status   text;
  v_movement public.cash_movements;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT status INTO v_status
    FROM public.cash_register_sessions
   WHERE id = p_session_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session de caisse introuvable';
  END IF;

  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'La session de caisse est déjà clôturée';
  END IF;

  INSERT INTO public.cash_movements (session_id, type, amount_dt, reason, actor_id)
  VALUES (p_session_id, p_type, p_amount, p_reason, v_actor_id)
  RETURNING * INTO v_movement;

  RETURN v_movement;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_add_cash_movement(uuid, text, numeric, text) TO authenticated;

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

  RETURN v_session;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_close_session(uuid, numeric, text) TO authenticated;
