alter table public.profiles
  add column if not exists is_archived boolean not null default false;

comment on column public.profiles.is_archived is
  'Soft-delete flag. Archived users cannot log in (Supabase ban). Data is preserved.';
