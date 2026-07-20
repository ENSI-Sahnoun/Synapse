-- apps/database/supabase/migrations/20260720000300_recurring_expenses_payroll.sql
--
-- Fixed costs and labour.
--
-- Today `expenses` is a flat, manually-keyed table. Rent, utilities, internet
-- and salaries must be re-entered every month from memory. Forget the 1 200 DT
-- rent and the month simply shows 1 200 DT more profit — and since there is no
-- budget, no variance check and no per-category month-on-month comparison,
-- nothing flags the omission. The positive delta presents it as good news.
--
-- Payroll is worse: `profiles` carries no wage of any kind, `employee_attendance`
-- has recorded real clock-in/clock-out since 20260713000000 and is never used
-- for cost, and `analytics/staff.ts` derives "shifts worked" from the
-- `weekly_schedules` TEMPLATE — so an employee who never showed up still gets a
-- full denominator, flattering absence.

-- ---------------------------------------------------------------------------
-- 1. Recurring expenses
-- ---------------------------------------------------------------------------

CREATE TABLE public.recurring_expenses (
  id                  uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_category_id uuid NOT NULL REFERENCES public.account_categories(id),
  description         text NOT NULL CHECK (length(trim(description)) > 0),
  amount_dt           numeric NOT NULL CHECK (amount_dt > 0),
  frequency           text NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'yearly')),
  -- Capped at 28 so every month has the day; "last day of month" is not
  -- expressible and does not need to be for rent/utilities.
  day_of_month        int NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 28),
  starts_on           date NOT NULL,
  ends_on             date,
  is_active           boolean NOT NULL DEFAULT true,
  created_by          uuid NOT NULL REFERENCES public.profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recurring_expenses_period_order CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS recurring_expense_id uuid REFERENCES public.recurring_expenses(id) ON DELETE SET NULL;

-- Idempotency guard: materialisation can run repeatedly (cron retry, manual
-- catch-up, a redeploy) and must never post the same month's rent twice.
CREATE UNIQUE INDEX IF NOT EXISTS expenses_recurring_month_uniq
  ON public.expenses (recurring_expense_id, date)
  WHERE recurring_expense_id IS NOT NULL;

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_expenses_admin_all" ON public.recurring_expenses
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE TRIGGER audit_recurring_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION public.log_financial_change();

-- Posts every due recurring expense whose date falls on or before p_through.
-- Returns how many rows it created. Safe to call at any time.
CREATE OR REPLACE FUNCTION public.materialise_recurring_expenses(p_through date DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_through date := COALESCE(p_through, (now() AT TIME ZONE 'Africa/Tunis')::date);
  v_rec     record;
  v_due     date;
  v_created int := 0;
BEGIN
  FOR v_rec IN
    SELECT * FROM public.recurring_expenses
     WHERE is_active AND starts_on <= v_through
  LOOP
    -- Walk every occurrence from the start date to `through`. Backfilling like
    -- this means switching one on mid-year still produces a complete history,
    -- and a cron outage self-heals on the next run instead of leaving a
    -- permanent hole in the P&L.
    v_due := date_trunc('month', v_rec.starts_on)::date + (v_rec.day_of_month - 1);
    IF v_due < v_rec.starts_on THEN
      v_due := (date_trunc('month', v_rec.starts_on) + interval '1 month')::date
               + (v_rec.day_of_month - 1);
    END IF;

    WHILE v_due <= v_through AND (v_rec.ends_on IS NULL OR v_due <= v_rec.ends_on) LOOP
      INSERT INTO public.expenses (
        account_category_id, description, amount_dt, date, created_by, recurring_expense_id
      )
      VALUES (
        v_rec.account_category_id, v_rec.description, v_rec.amount_dt,
        v_due, v_rec.created_by, v_rec.id
      )
      ON CONFLICT (recurring_expense_id, date) DO NOTHING;

      IF FOUND THEN
        v_created := v_created + 1;
      END IF;

      v_due := CASE v_rec.frequency
                 WHEN 'monthly'   THEN (v_due + interval '1 month')::date
                 WHEN 'quarterly' THEN (v_due + interval '3 months')::date
                 ELSE                  (v_due + interval '1 year')::date
               END;
    END LOOP;
  END LOOP;

  RETURN v_created;
END;
$$;

GRANT EXECUTE ON FUNCTION public.materialise_recurring_expenses(date) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('materialise-recurring-expenses')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'materialise-recurring-expenses');

    -- Daily rather than monthly: a daily run backfills anything missed within
    -- 24h instead of waiting a month, and the ON CONFLICT guard makes repeats
    -- free.
    PERFORM cron.schedule(
      'materialise-recurring-expenses',
      '15 2 * * *',
      $cron$ SELECT public.materialise_recurring_expenses(); $cron$
    );
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Payroll
-- ---------------------------------------------------------------------------

-- Both models supported: hourly staff costed from real clocked hours, salaried
-- staff from a flat monthly figure. NULL means "not payroll-costed" so the
-- ratio can honestly report incomplete coverage rather than silently assuming 0.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hourly_rate_dt numeric CHECK (hourly_rate_dt IS NULL OR hourly_rate_dt >= 0);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_salary_dt numeric CHECK (monthly_salary_dt IS NULL OR monthly_salary_dt >= 0);

-- Labour cost and hours for a period, from ACTUAL attendance.
CREATE OR REPLACE FUNCTION public.analytics_labor(p_from date, p_to date)
RETURNS TABLE (
  hours_worked      numeric,
  hourly_cost_dt    numeric,
  salaried_cost_dt  numeric,
  total_cost_dt     numeric,
  staff_counted     bigint,
  staff_unrated     bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lo timestamptz := (p_from::timestamp AT TIME ZONE 'Africa/Tunis');
  v_hi timestamptz := ((p_to + 1)::timestamp AT TIME ZONE 'Africa/Tunis');
  v_month_fraction numeric;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  -- A monthly salary is pro-rated across the reported window, so a 10-day
  -- range does not book a full month of wages against 10 days of revenue.
  v_month_fraction := ((p_to - p_from) + 1)::numeric / 30.4375;

  RETURN QUERY
  WITH shifts AS (
    SELECT
      ea.employee_id,
      -- Mirrors the 24h cap from 20260709120000: an un-clocked-out shift must
      -- not bill an unbounded number of hours.
      LEAST(EXTRACT(EPOCH FROM (ea.clock_out - ea.clock_in)) / 3600.0, 24) AS hours
    FROM public.employee_attendance ea
    WHERE ea.clock_out IS NOT NULL
      AND ea.clock_in >= v_lo AND ea.clock_in < v_hi
  ),
  per_staff AS (
    SELECT s.employee_id, SUM(s.hours) AS hours
    FROM shifts s GROUP BY s.employee_id
  )
  SELECT
    COALESCE(SUM(ps.hours), 0),
    COALESCE(SUM(ps.hours * COALESCE(p.hourly_rate_dt, 0)), 0),
    COALESCE((
      SELECT SUM(pr.monthly_salary_dt) * v_month_fraction
      FROM public.profiles pr
      WHERE pr.monthly_salary_dt IS NOT NULL AND pr.role IN ('employee', 'admin')
    ), 0),
    COALESCE(SUM(ps.hours * COALESCE(p.hourly_rate_dt, 0)), 0)
      + COALESCE((
          SELECT SUM(pr.monthly_salary_dt) * v_month_fraction
          FROM public.profiles pr
          WHERE pr.monthly_salary_dt IS NOT NULL AND pr.role IN ('employee', 'admin')
        ), 0),
    COUNT(*)::bigint,
    -- Surfaced so the UI can warn that the ratio understates, rather than
    -- presenting an incomplete figure as authoritative.
    COUNT(*) FILTER (WHERE p.hourly_rate_dt IS NULL AND p.monthly_salary_dt IS NULL)::bigint
  FROM per_staff ps
  JOIN public.profiles p ON p.id = ps.employee_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_labor(date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
