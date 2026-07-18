-- apps/database/supabase/migrations/20260718020000_capital_accounts.sql
-- Owner financial cockpit's P&L is flow-only. This adds a balance-sheet
-- concept: how much cash/bank the business actually holds, all-time.
-- Purely additive — existing expenses/purchases/subscriptions are untouched
-- and implicitly all land in "cash"; bank only moves via explicit transfers.

CREATE TYPE public.capital_account AS ENUM ('cash', 'bank');

CREATE TABLE public.capital_movements (
  id         uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account    public.capital_account NOT NULL,
  amount_dt  numeric NOT NULL,
  date       date NOT NULL,
  note       text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.capital_transfers (
  id            uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  from_account  public.capital_account NOT NULL,
  to_account    public.capital_account NOT NULL,
  amount_dt     numeric NOT NULL CHECK (amount_dt > 0),
  date          date NOT NULL,
  note          text,
  created_by    uuid REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT capital_transfers_distinct_accounts CHECK (from_account <> to_account)
);

CREATE INDEX capital_movements_account_idx ON public.capital_movements (account);
CREATE INDEX capital_transfers_accounts_idx ON public.capital_transfers (from_account, to_account);

ALTER TABLE public.capital_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capital_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "capital_movements_admin_all" ON public.capital_movements
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "capital_transfers_admin_all" ON public.capital_transfers
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');
