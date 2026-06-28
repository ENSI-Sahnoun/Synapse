-- apps/database/supabase/migrations/20260623400000_notification_channel_config.sql

CREATE TABLE IF NOT EXISTS public.notification_channel_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL CHECK (
    notification_type IN ('expiry_7d', 'expiry_3d', 'expiry_1d', 'expired', 'renewal_reminder')
  ),
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'inapp')),
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_type, channel)
);

ALTER TABLE public.notification_channel_config ENABLE ROW LEVEL SECURITY;

-- Admin: full control
CREATE POLICY "admin_all_notification_channel_config"
  ON public.notification_channel_config
  FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Employees and service role: read only (for the API route processor)
CREATE POLICY "employee_read_notification_channel_config"
  ON public.notification_channel_config
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'employee'));

-- Seed default channel config (matches spec defaults)
INSERT INTO public.notification_channel_config (notification_type, channel, is_enabled)
VALUES
  ('expiry_7d',         'email',     true),
  ('expiry_7d',         'whatsapp',  true),
  ('expiry_7d',         'sms',       false),
  ('expiry_3d',         'email',     true),
  ('expiry_3d',         'whatsapp',  true),
  ('expiry_3d',         'sms',       false),
  ('expiry_1d',         'email',     true),
  ('expiry_1d',         'whatsapp',  true),
  ('expiry_1d',         'sms',       false),
  ('expired',           'email',     false),
  ('expired',           'sms',       true),
  ('expired',           'whatsapp',  true),
  ('renewal_reminder',  'email',     false),
  ('renewal_reminder',  'sms',       false),
  ('renewal_reminder',  'whatsapp',  true)
ON CONFLICT (notification_type, channel) DO NOTHING;

-- updated_at trigger
CREATE TRIGGER set_notification_channel_config_updated_at
  BEFORE UPDATE ON public.notification_channel_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
