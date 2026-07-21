-- Cap how far a user can drift their own display name from the name they
-- signed up with (typo fixes OK, full identity swap blocked).
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch" WITH SCHEMA "extensions";

ALTER TABLE public.profiles ADD COLUMN original_full_name text;
UPDATE public.profiles SET original_full_name = full_name WHERE original_full_name IS NULL;
ALTER TABLE public.profiles ALTER COLUMN original_full_name SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN original_full_name SET DEFAULT '';

-- Baseline is captured once, at account creation, and never touched again.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, original_full_name, phone, university, study_level)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'university',
    NEW.raw_user_meta_data->>'study_level'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_name_edit_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- original_full_name is a fixed baseline — no one edits it directly.
  NEW.original_full_name := OLD.original_full_name;

  -- Only self-edits are capped; staff correcting a user's name are exempt.
  IF auth.uid() = OLD.id
     AND NEW.full_name IS DISTINCT FROM OLD.full_name
     AND extensions.levenshtein(OLD.original_full_name, NEW.full_name) > 5
  THEN
    RAISE EXCEPTION 'Le nom ne peut pas différer de plus de 5 caractères du nom original.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_name_edit_limit
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_name_edit_limit();
