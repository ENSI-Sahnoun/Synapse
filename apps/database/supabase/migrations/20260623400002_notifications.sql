-- apps/database/supabase/migrations/20260623400002_notifications.sql

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (
    type IN ('expiry_7d', 'expiry_3d', 'expiry_1d', 'expired', 'renewal_reminder')
  ),
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Students can read their own notifications
CREATE POLICY "student_read_own_notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role inserts (via API route) — no RLS policy needed (service role bypasses)

-- Admin can read all
CREATE POLICY "admin_read_all_notifications"
  ON public.notifications
  FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'admin');
