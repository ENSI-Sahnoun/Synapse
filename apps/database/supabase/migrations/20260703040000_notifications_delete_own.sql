-- Allow authenticated users to clear (delete) their own notifications
CREATE POLICY "user_delete_own_notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
