-- Fix: admin_read_all_notifications (FOR ALL) caused admins to see all students' notifications.
-- student_read_own_notifications already applies to all authenticated users via auth.uid() = user_id,
-- so admins reading their own notifications is covered. Drop the overly broad admin policy.
DROP POLICY IF EXISTS "admin_read_all_notifications" ON public.notifications;
