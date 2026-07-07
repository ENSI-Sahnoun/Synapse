-- Replace one-off shift instances with a recurring weekly schedule per employee.
-- Admins set a Mon-Sun pattern (optional per day); employees see it on "Mes horaires".
CREATE TABLE public.weekly_schedules (
  id           uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  employee_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week  smallint    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Mon..6=Sun
  start_time   time        NOT NULL,
  end_time     time        NOT NULL CHECK (end_time > start_time),
  role         text        NOT NULL DEFAULT 'Front Desk',
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, day_of_week)
);

ALTER TABLE public.weekly_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_schedules_select_own_or_admin"
  ON public.weekly_schedules FOR SELECT TO authenticated
  USING (auth.uid() = employee_id OR public.current_user_role() = 'admin');

CREATE POLICY "weekly_schedules_admin_all"
  ON public.weekly_schedules FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

grant select, insert, update, delete on public.weekly_schedules to authenticated, service_role;

DROP TABLE public.shifts;
