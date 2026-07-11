-- apps/database/supabase/migrations/20260711000100_lockers_one_per_student.sql

-- DB-level enforcement of "one locker per student": application code already
-- frees a student's other locker before assigning a new one, but this closes
-- the gap for direct-DB writes and the check-then-update race between two
-- concurrent assign calls (accepted as low-risk for a staff-only in-person
-- tool, hardened here at negligible cost).
CREATE UNIQUE INDEX lockers_one_per_student_idx
  ON public.lockers (assigned_student_id)
  WHERE assigned_student_id IS NOT NULL;
