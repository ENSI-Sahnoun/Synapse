-- Allow qr_token to be NULL: the app now sets it via HMAC after user creation.
-- Remove NOT NULL constraint and DEFAULT so the trigger can insert NULL.
ALTER TABLE public.profiles
  ALTER COLUMN qr_token DROP NOT NULL,
  ALTER COLUMN qr_token DROP DEFAULT;

-- The trigger no longer generates qr_token — the app generates it via HMAC.
-- After user creation the app calls the updateQrToken server action.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, university, study_level, qr_token)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'university',
    NEW.raw_user_meta_data->>'study_level',
    NULL  -- App sets qr_token after creation via HMAC
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
