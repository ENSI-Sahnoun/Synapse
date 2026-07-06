-- handle_new_user only set credentials_set via the one-off backfill in
-- 20260704130000; new signups always got the column default (false), so
-- students signing up with a real email still saw the "secure your account"
-- banner. Mirror the same real-email check on insert.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, university, study_level, qr_token, credentials_set)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'university',
    NEW.raw_user_meta_data->>'study_level',
    NULL,  -- App sets qr_token after creation via HMAC
    NEW.email IS NOT NULL AND NEW.email NOT LIKE '%@synapse.local'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Fix accounts created since the trigger regressed: real email, wrongly
-- flagged credentials_set = false.
UPDATE public.profiles p
SET credentials_set = true
FROM auth.users u
WHERE u.id = p.id
  AND p.credentials_set = false
  AND u.email IS NOT NULL
  AND u.email NOT LIKE '%@synapse.local';
