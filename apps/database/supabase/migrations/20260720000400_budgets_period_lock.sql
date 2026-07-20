-- apps/database/supabase/migrations/20260720000400_budgets_period_lock.sql
--
-- Two controls that turn reporting into accounting.
--
-- BUDGETS. Nothing in the system detects a cost line going wrong. The owner
-- sees what was spent, never what was meant to be spent, so a supplier price
-- rise or a creeping utility bill is only noticed when net profit finally
-- moves — by which point it has been happening for months.
--
-- PERIOD LOCKING. Any admin can post or delete an expense dated into any past
-- month at any time. A P&L exported and filed in March can quietly become a
-- different P&L in July, with no indication it changed. Once a period is
-- closed, it must stop moving.

-- ---------------------------------------------------------------------------
-- 1. Budgets
-- ---------------------------------------------------------------------------

CREATE TABLE public.budgets (
  id                  uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_category_id uuid NOT NULL REFERENCES public.account_categories(id) ON DELETE CASCADE,
  -- First day of the budgeted month. A date rather than a year/month pair so
  -- range queries stay simple.
  month               date NOT NULL,
  amount_dt           numeric NOT NULL CHECK (amount_dt >= 0),
  note                text,
  created_by          uuid NOT NULL REFERENCES public.profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budgets_month_is_first_day CHECK (EXTRACT(DAY FROM month) = 1),
  CONSTRAINT budgets_unique_category_month UNIQUE (account_category_id, month)
);

CREATE INDEX budgets_month_idx ON public.budgets (month);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budgets_admin_all" ON public.budgets
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Budget vs actual for a month, per category, including categories that have a
-- budget but no spend (a line at 0% consumed is as informative as one at 200%)
-- and categories with spend but no budget (unplanned cost).
CREATE OR REPLACE FUNCTION public.analytics_budget_variance(p_month date)
RETURNS TABLE (
  category_id    uuid,
  category_name  text,
  budget_dt      numeric,
  actual_dt      numeric,
  variance_dt    numeric,
  consumed_pct   numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start date := date_trunc('month', p_month)::date;
  v_end   date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  RETURN QUERY
  WITH actuals AS (
    SELECT e.account_category_id AS cid, SUM(e.amount_dt) AS spent
    FROM public.expenses e
    WHERE e.date >= v_start AND e.date <= v_end
    GROUP BY e.account_category_id
  ),
  planned AS (
    SELECT b.account_category_id AS cid, b.amount_dt AS budget
    FROM public.budgets b
    WHERE b.month = v_start
  )
  SELECT
    ac.id,
    ac.name,
    COALESCE(planned.budget, 0),
    COALESCE(actuals.spent, 0),
    -- Positive = under budget, which reads correctly as "money left".
    COALESCE(planned.budget, 0) - COALESCE(actuals.spent, 0),
    CASE WHEN COALESCE(planned.budget, 0) > 0
         THEN COALESCE(actuals.spent, 0) / planned.budget * 100
         ELSE NULL END
  FROM public.account_categories ac
  LEFT JOIN actuals ON actuals.cid = ac.id
  LEFT JOIN planned ON planned.cid = ac.id
  WHERE ac.type = 'expense'
    AND (planned.budget IS NOT NULL OR actuals.spent IS NOT NULL)
  ORDER BY (COALESCE(actuals.spent, 0) - COALESCE(planned.budget, 0)) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_budget_variance(date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Fiscal period locking
-- ---------------------------------------------------------------------------

CREATE TABLE public.fiscal_period_locks (
  month      date PRIMARY KEY,
  locked_by  uuid NOT NULL REFERENCES public.profiles(id),
  locked_at  timestamptz NOT NULL DEFAULT now(),
  note       text,
  CONSTRAINT fiscal_period_locks_month_is_first_day CHECK (EXTRACT(DAY FROM month) = 1)
);

ALTER TABLE public.fiscal_period_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_period_locks_read" ON public.fiscal_period_locks
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('admin', 'employee'));

CREATE POLICY "fiscal_period_locks_admin_write" ON public.fiscal_period_locks
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE OR REPLACE FUNCTION public.is_period_locked(p_date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.fiscal_period_locks
    WHERE month = date_trunc('month', p_date)::date
  );
$$;

-- Refuses any write whose effective date falls in a locked month, including
-- moving a row OUT of one. A correction to a closed period must be posted in an
-- open period — that is the whole point of closing.
CREATE OR REPLACE FUNCTION public.guard_locked_period()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new date;
  v_old date;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new := (to_jsonb(NEW) ->> TG_ARGV[0])::date;
    IF v_new IS NOT NULL AND public.is_period_locked(v_new) THEN
      RAISE EXCEPTION 'Période close (%) — écriture impossible. Passez la correction sur une période ouverte.',
        to_char(v_new, 'MM/YYYY');
    END IF;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old := (to_jsonb(OLD) ->> TG_ARGV[0])::date;
    IF v_old IS NOT NULL AND public.is_period_locked(v_old) THEN
      RAISE EXCEPTION 'Période close (%) — modification impossible.',
        to_char(v_old, 'MM/YYYY');
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- `expenses.date` is a date; the revenue tables key off `created_at`, which
-- casts cleanly to date. BEFORE triggers so the write is rejected outright.
CREATE TRIGGER lock_guard_expenses
  BEFORE INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.guard_locked_period('date');

CREATE TRIGGER lock_guard_purchases
  BEFORE INSERT OR UPDATE OR DELETE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.guard_locked_period('created_at');

CREATE TRIGGER lock_guard_subscriptions
  BEFORE INSERT OR UPDATE OR DELETE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.guard_locked_period('created_at');

CREATE TRIGGER lock_guard_locker_payments
  BEFORE INSERT OR UPDATE OR DELETE ON public.locker_payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_locked_period('created_at');

CREATE TRIGGER lock_guard_capital_movements
  BEFORE INSERT OR UPDATE OR DELETE ON public.capital_movements
  FOR EACH ROW EXECUTE FUNCTION public.guard_locked_period('date');

CREATE TRIGGER lock_guard_capital_transfers
  BEFORE INSERT OR UPDATE OR DELETE ON public.capital_transfers
  FOR EACH ROW EXECUTE FUNCTION public.guard_locked_period('date');

NOTIFY pgrst, 'reload schema';
