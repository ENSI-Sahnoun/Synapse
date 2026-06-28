-- Restrict writes on notification_channel_config to admin role only
-- Reads remain open to authenticated (needed by notification dispatcher)

-- Drop the overly broad FOR ALL policy and replace with explicit operation-level policies
DROP POLICY IF EXISTS "admin_all_notification_channel_config" ON public.notification_channel_config;

-- Allow all authenticated users to SELECT (dispatcher needs read access)
CREATE POLICY "notification_channel_config_select"
  ON public.notification_channel_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can INSERT
CREATE POLICY "notification_channel_config_insert"
  ON public.notification_channel_config
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

-- Only admins can UPDATE
CREATE POLICY "notification_channel_config_update"
  ON public.notification_channel_config
  FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Only admins can DELETE
CREATE POLICY "notification_channel_config_delete"
  ON public.notification_channel_config
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'admin');

-- Note: The "employee_read_notification_channel_config" policy is now redundant
-- since we allow all authenticated users to SELECT above.
-- Keeping it for now for backward compatibility, but it will be effectively
-- superseded by the new "notification_channel_config_select" policy.
