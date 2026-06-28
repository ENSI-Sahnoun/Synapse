-- Allow authenticated users to mark their own notifications as read
CREATE POLICY "user_update_own_notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
