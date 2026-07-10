-- apps/database/supabase/migrations/20260710000000_cash_register_sessions_schema.sql
-- Caisse réelle: single shared cash-drawer session for the POS, with mid-shift
-- cash in/out movements. Writes go exclusively through SECURITY DEFINER
-- functions in the companion migration (pos_open_session, pos_add_cash_movement,
-- pos_close_session), consistent with the pos_activity_log/purchases convention.

CREATE TABLE public.cash_register_sessions (
  id                  uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  status              text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opened_by           uuid NOT NULL REFERENCES public.profiles(id),
  opened_at           timestamptz NOT NULL DEFAULT now(),
  opening_amount_dt   numeric NOT NULL CHECK (opening_amount_dt >= 0),
  closed_by           uuid REFERENCES public.profiles(id),
  closed_at           timestamptz,
  closing_amount_dt   numeric,
  expected_amount_dt  numeric,
  discrepancy_dt      numeric,
  notes               text
);

-- Enforce single open session (shared register)
CREATE UNIQUE INDEX one_open_cash_session ON public.cash_register_sessions ((status)) WHERE status = 'open';

CREATE INDEX cash_register_sessions_opened_at_idx ON public.cash_register_sessions (opened_at DESC);

ALTER TABLE public.cash_register_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_register_sessions_select" ON public.cash_register_sessions
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('admin', 'employee'));

-- No direct INSERT/UPDATE/DELETE policy: only SECURITY DEFINER functions
-- (pos_open_session, pos_close_session) write to this table.

CREATE TABLE public.cash_movements (
  id         uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  session_id uuid NOT NULL REFERENCES public.cash_register_sessions(id),
  type       text NOT NULL CHECK (type IN ('in','out')),
  amount_dt  numeric NOT NULL CHECK (amount_dt > 0),
  reason     text NOT NULL,
  actor_id   uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cash_movements_session_idx ON public.cash_movements (session_id);

ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_movements_select" ON public.cash_movements
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('admin', 'employee'));

-- No direct INSERT/UPDATE/DELETE policy: only pos_add_cash_movement writes here.

-- Realtime publication (same pattern as 20260706130000_realtime_publication_expand.sql
-- / 20260709000000_realtime_weekly_schedules.sql) so the POS status bar and the
-- admin sessions page can go live.
DO $$
DECLARE
  t text;
  tbls text[] := ARRAY['cash_register_sessions', 'cash_movements'];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
