-- apps/database/supabase/migrations/20260623000002_smp_profiles.sql

CREATE TABLE public.profiles (
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          text        NOT NULL DEFAULT 'student'
                            CHECK (role IN ('admin', 'employee', 'student')),
  full_name     text        NOT NULL DEFAULT '',
  phone         text,
  university    text,
  study_level   text,
  -- qr_token used for check-in (Phase 2 replaces value with HMAC; column defined here)
  qr_token      text        NOT NULL UNIQUE DEFAULT ('SYNAPSE-' || encode(extensions.gen_random_bytes(16), 'hex')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on auth.users insert (self-signup + admin-created users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, university, study_level)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'university',
    NEW.raw_user_meta_data->>'study_level'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Read: own profile, or admin/employee reads all
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id
    OR current_user_role() IN ('admin', 'employee')
  );

-- Insert: self-signup (auth.uid = id) OR admin/employee creating a user
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id
    OR current_user_role() IN ('admin', 'employee')
  );

-- Update: own profile (students); employees update students only; admin updates all
-- WITH CHECK prevents students from self-escalating their role
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE
  USING (
    auth.uid() = id
    OR current_user_role() = 'admin'
    OR (current_user_role() = 'employee' AND role = 'student')
  )
  WITH CHECK (
    (auth.uid() = id AND current_user_role() = 'student' AND role = 'student')
    OR current_user_role() = 'admin'
    OR (current_user_role() = 'employee' AND role = 'student')
  );

-- Delete: admin only
CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE USING (current_user_role() = 'admin');
