-- Celebration popups: one event row per student-facing win (POS purchase,
-- subscription, locker assignment). The student app shows a confetti popup
-- for the latest unseen event, instantly via realtime or on next app open.

CREATE TABLE public.celebration_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('purchase', 'subscription', 'locker')),
  -- kind-specific display data:
  --   purchase:     { items: [{ name, quantity }], total_dt }
  --   subscription: { plan_name }
  --   locker:       { locker_number }
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  points        int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  celebrated_at timestamptz
);

CREATE INDEX celebration_events_uncelebrated_idx
  ON public.celebration_events (student_id, created_at DESC)
  WHERE celebrated_at IS NULL;

ALTER TABLE public.celebration_events ENABLE ROW LEVEL SECURITY;

-- Students read their own events (also required for realtime INSERT delivery;
-- postgres_changes respects RLS).
CREATE POLICY "celebration_events_student_select_own"
  ON public.celebration_events FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()));

-- Staff-side flows (subscription sale, locker assignment) insert events.
CREATE POLICY "celebration_events_staff_insert"
  ON public.celebration_events FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin', 'employee'));

-- Realtime delivery (publication membership + full row payloads).
ALTER TABLE public.celebration_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.celebration_events;

-- Mark ALL own unseen events seen (latest-only celebrate policy: the popup
-- shows only the newest event, older ones are silently acknowledged).
CREATE OR REPLACE FUNCTION public.mark_my_celebrations_seen()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.celebration_events
     SET celebrated_at = now()
   WHERE student_id = (SELECT auth.uid())
     AND celebrated_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.mark_my_celebrations_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_my_celebrations_seen() TO authenticated;

-- pos_checkout: unchanged except it now also records a celebration event for
-- student purchases (with item names for the popup).
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
  v_is_student   boolean;
  v_event_items  jsonb := '[]'::jsonb;
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

    v_event_items := v_event_items || jsonb_build_object('name', v_name, 'quantity', v_quantity);
  END LOOP;

  IF p_student_id IS NOT NULL THEN
    SELECT (role = 'student') INTO v_is_student FROM public.profiles WHERE id = p_student_id;

    IF v_is_student THEN
      v_points := floor(v_total_dt)::int;
      IF v_points > 0 THEN
        INSERT INTO public.loyalty_ledger (student_id, points_delta, reason, ref_id)
        VALUES (p_student_id, v_points, 'purchase', v_purchase_id);
      END IF;

      INSERT INTO public.celebration_events (student_id, kind, payload, points)
      VALUES (
        p_student_id,
        'purchase',
        jsonb_build_object('items', v_event_items, 'total_dt', v_total_dt),
        v_points
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('purchase_id', v_purchase_id, 'total_dt', v_total_dt, 'points_earned', v_points);
END;
$$;
