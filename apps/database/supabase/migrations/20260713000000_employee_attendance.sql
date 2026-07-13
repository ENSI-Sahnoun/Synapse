-- Employee time tracking ("pointage"): clock-in/out log per employee, distinct
-- from student `attendance` (no seat/room, compared against weekly_schedules
-- for late/absence detection).
CREATE TABLE public.employee_attendance (
  id           uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  employee_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  clock_in     timestamptz NOT NULL DEFAULT now(),
  clock_out    timestamptz,
  entry_method text        NOT NULL DEFAULT 'qr_scan' CHECK (entry_method IN ('qr_scan', 'manual_web', 'admin_edit')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX employee_attendance_employee_id_idx ON public.employee_attendance (employee_id, clock_in DESC);

ALTER TABLE public.employee_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_attendance_select_own_or_admin"
  ON public.employee_attendance FOR SELECT TO authenticated
  USING (auth.uid() = employee_id OR public.current_user_role() = 'admin');

CREATE POLICY "employee_attendance_insert_own_or_admin"
  ON public.employee_attendance FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = employee_id OR public.current_user_role() = 'admin');

CREATE POLICY "employee_attendance_update_own_or_admin"
  ON public.employee_attendance FOR UPDATE TO authenticated
  USING (auth.uid() = employee_id OR public.current_user_role() = 'admin')
  WITH CHECK (auth.uid() = employee_id OR public.current_user_role() = 'admin');

CREATE POLICY "employee_attendance_admin_delete"
  ON public.employee_attendance FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');

grant select, insert, update, delete on public.employee_attendance to authenticated, service_role;

ALTER TABLE public.employee_attendance REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'employee_attendance'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_attendance;
  END IF;
END $$;
