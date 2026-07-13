-- Dedicated 'kiosk' account role: admin-created device credentials that,
-- once logged in, are locked to /kiosk only (see middleware.ts ROLE_HOME).
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'employee', 'student', 'kiosk'));
