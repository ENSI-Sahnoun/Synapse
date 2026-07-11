-- notifications.student_id (added in 20260711120000) had no ON DELETE clause,
-- defaulting to RESTRICT — this silently blocks hard-deleting any student who
-- was ever dropped to the kiosk, since their kiosk_qr_drop notification rows
-- (one per staff member, persisted, already excluded from all UI) still
-- reference the profile being deleted. A deleted student's kiosk-drop history
-- should just lose the now-meaningless reference, not block the delete.
ALTER TABLE public.notifications
  DROP CONSTRAINT notifications_student_id_fkey;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
