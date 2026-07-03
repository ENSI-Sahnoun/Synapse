-- Allow server actions (running as the student's auth role) to update seat status.
-- The application-level guard in the server action ensures only valid transitions
-- (free → reserved) are made by students; this policy just unblocks RLS.
CREATE POLICY "seats_update_status_student"
  ON public.seats FOR UPDATE
  USING (auth.uid() IS NOT NULL);
