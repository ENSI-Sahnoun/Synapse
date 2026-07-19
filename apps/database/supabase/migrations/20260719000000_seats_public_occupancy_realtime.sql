-- The public landing page shows live seat occupancy to logged-out visitors.
-- Realtime delivery is gated by RLS for the connecting role (anon here), so
-- without a permissive SELECT policy every postgres_changes event on
-- `seats` is silently dropped for that socket. Column-level GRANTs keep the
-- anon role's actual read surface to just what the widget aggregates —
-- no seat labels/positions/table grouping leak out.

CREATE POLICY "seats_select_public_occupancy" ON public.seats
  FOR SELECT
  TO anon
  USING (true);

-- Supabase's default bootstrap already grants anon a blanket table-level
-- SELECT on every public table; a narrower column GRANT on top of that is a
-- no-op (the broader grant wins). REVOKE first so the column list below is
-- actually the ceiling, not just documentation.
REVOKE SELECT ON public.seats FROM anon;
GRANT SELECT (id, room_id, status) ON public.seats TO anon;
