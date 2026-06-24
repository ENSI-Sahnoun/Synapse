-- student_number: friendly 6-digit auto-increment ID (100001, 100002, ...)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS student_number integer GENERATED ALWAYS AS IDENTITY (START WITH 100001),
  ADD COLUMN IF NOT EXISTS token_version  integer NOT NULL DEFAULT 0;

-- Unique constraint so no two students share a number or a token
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_student_number_unique UNIQUE (student_number);

-- Fast lookup by student_number (employee search, display)
CREATE INDEX IF NOT EXISTS profiles_student_number_idx ON public.profiles (student_number);
