-- apps/database/supabase/migrations/20260717010000_subscriptions_employee_edit.sql
-- Admins and employees can both freely edit/remove subscriptions (was admin-only).

DROP POLICY IF EXISTS "subscriptions_update" ON public.subscriptions;
CREATE POLICY "subscriptions_update" ON public.subscriptions
  FOR UPDATE USING (current_user_role() IN ('admin', 'employee'));

DROP POLICY IF EXISTS "subscriptions_delete" ON public.subscriptions;
CREATE POLICY "subscriptions_delete" ON public.subscriptions
  FOR DELETE USING (current_user_role() IN ('admin', 'employee'));
