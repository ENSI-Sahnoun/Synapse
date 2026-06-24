CREATE TABLE public.attendance (
  id              uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  student_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- seat_id / room_id added as FK in Phase 3 migration once those tables exist
  seat_id         uuid,
  room_id         uuid,
  checked_in_at   timestamptz NOT NULL DEFAULT now(),
  checked_out_at  timestamptz,
  entry_method    text        NOT NULL CHECK (entry_method IN ('qr_scan', 'manual'))
);

CREATE INDEX attendance_student_open_idx
  ON public.attendance (student_id)
  WHERE checked_out_at IS NULL;

CREATE INDEX attendance_checked_in_at_idx
  ON public.attendance (checked_in_at DESC);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_select" ON public.attendance
  FOR SELECT USING (
    student_id = auth.uid()
    OR current_user_role() IN ('admin', 'employee')
  );

CREATE POLICY "attendance_insert" ON public.attendance
  FOR INSERT WITH CHECK (current_user_role() IN ('admin', 'employee'));

CREATE POLICY "attendance_update" ON public.attendance
  FOR UPDATE USING (current_user_role() IN ('admin', 'employee'));

CREATE POLICY "attendance_delete" ON public.attendance
  FOR DELETE USING (current_user_role() = 'admin');
