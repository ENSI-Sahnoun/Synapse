-- Track whether an account has set its own credentials (real email + password).
-- Employee-created student accounts start false; QR login is only allowed while false.
alter table public.profiles
  add column if not exists credentials_set boolean not null default false;

-- Backfill: accounts with a real email (not the employee-created placeholder)
-- already manage their own credentials.
update public.profiles p
set credentials_set = true
from auth.users u
where u.id = p.id
  and u.email is not null
  and u.email not like '%@synapse.local';
