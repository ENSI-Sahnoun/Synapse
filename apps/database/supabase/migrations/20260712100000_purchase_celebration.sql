-- Purchase celebration popup: track which purchases the student has been
-- shown confetti for, and give students the minimal read access needed.

ALTER TABLE public.purchases ADD COLUMN celebrated_at timestamptz;

-- Cheap catch-up lookup on app open.
CREATE INDEX purchases_uncelebrated_idx
  ON public.purchases (student_id)
  WHERE celebrated_at IS NULL;

-- Students may see their own purchases (required for realtime INSERT events;
-- postgres_changes respects RLS).
CREATE POLICY "purchases_student_select_own"
  ON public.purchases FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()));

-- Latest uncelebrated purchase (7-day cutoff) with items and points.
-- SECURITY DEFINER so students need no RLS on purchase_items/products/ledger.
CREATE OR REPLACE FUNCTION public.get_my_uncelebrated_purchase()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'purchase_id', p.id,
    'total_dt', p.total_dt,
    'created_at', p.created_at,
    'points', COALESCE((
      SELECT ll.points_delta FROM public.loyalty_ledger ll
      WHERE ll.ref_id = p.id AND ll.reason = 'purchase'
        AND ll.student_id = (SELECT auth.uid())
      LIMIT 1
    ), 0),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', pr.name, 'quantity', pi.quantity))
      FROM public.purchase_items pi
      JOIN public.products pr ON pr.id = pi.product_id
      WHERE pi.purchase_id = p.id
    ), '[]'::jsonb)
  )
  FROM public.purchases p
  WHERE p.student_id = (SELECT auth.uid())
    AND p.celebrated_at IS NULL
    AND p.created_at > now() - interval '7 days'
  ORDER BY p.created_at DESC
  LIMIT 1;
$$;

-- Mark ALL own uncelebrated purchases seen (latest-only celebrate policy).
CREATE OR REPLACE FUNCTION public.mark_my_purchases_celebrated()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.purchases
     SET celebrated_at = now()
   WHERE student_id = (SELECT auth.uid())
     AND celebrated_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.get_my_uncelebrated_purchase() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_my_purchases_celebrated() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_uncelebrated_purchase() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_my_purchases_celebrated() TO authenticated;
