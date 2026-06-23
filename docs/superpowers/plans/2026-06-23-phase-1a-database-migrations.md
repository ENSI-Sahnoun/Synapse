# Phase 1A: Database Migrations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create all Phase 1 Supabase migrations — profiles, subscription plans, subscriptions, settings, and account categories — with RLS and triggers.

**Architecture:** Migrations live in `apps/database/supabase/migrations/`. Each migration is a standalone SQL file with a UTC timestamp prefix. RLS is enforced on every table. A `current_user_role()` security-definer function avoids recursive RLS lookups. A trigger auto-creates a `profiles` row on every `auth.users` insert.

**Tech Stack:** Supabase (Postgres 15+), pgcrypto, pnpm + Turborepo

## Global Constraints

- Migration filenames: `YYYYMMDDHHmmss_<name>.sql` — prefix must be newer than `20251117162807`
- RLS must be enabled on every new table — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- `subscriptions.end_date` always computed as `start_date + plan.duration_days` — never set manually
- `profiles.role` only values: `'admin' | 'employee' | 'student'`
- The trigger always creates profiles with `role = 'student'` — role elevation done via server action
- Cash-only: no `payment_method` column anywhere
- Run all commands from `/home/sah/Synapse` (repo root)

---

### Task 1: Cleanup boilerplate + utility functions

**Files:**
- Create: `apps/database/supabase/migrations/20260623000000_smp_cleanup.sql`
- Create: `apps/database/supabase/migrations/20260623000001_smp_utilities.sql`

- [ ] **Step 1: Write cleanup migration**

```sql
-- apps/database/supabase/migrations/20260623000000_smp_cleanup.sql

-- Remove NextBase boilerplate tables not used in SMP
DROP TABLE IF EXISTS public.blog_posts CASCADE;
DROP TABLE IF EXISTS public.private_items CASCADE;
DROP TABLE IF EXISTS public.items CASCADE;
```

- [ ] **Step 2: Write utilities migration**

```sql
-- apps/database/supabase/migrations/20260623000001_smp_utilities.sql

-- Reusable updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Security-definer role helper — avoids recursive RLS on profiles table
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;
```

- [ ] **Step 3: Commit**

```bash
git add apps/database/supabase/migrations/20260623000000_smp_cleanup.sql \
        apps/database/supabase/migrations/20260623000001_smp_utilities.sql
git commit -m "feat(db): cleanup boilerplate, add utility functions"
```

---

### Task 2: Profiles table

**Files:**
- Create: `apps/database/supabase/migrations/20260623000002_smp_profiles.sql`

- [ ] **Step 1: Write profiles migration**

```sql
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
  qr_token      text        UNIQUE DEFAULT ('SYNAPSE-' || encode(extensions.gen_random_bytes(16), 'hex')),
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
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id
    OR current_user_role() = 'admin'
    OR (current_user_role() = 'employee' AND role = 'student')
  );

-- Delete: admin only
CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE USING (current_user_role() = 'admin');
```

- [ ] **Step 2: Commit**

```bash
git add apps/database/supabase/migrations/20260623000002_smp_profiles.sql
git commit -m "feat(db): add profiles table with RLS and auto-create trigger"
```

---

### Task 3: Subscription plans table

**Files:**
- Create: `apps/database/supabase/migrations/20260623000003_smp_subscription_plans.sql`

- [ ] **Step 1: Write migration**

```sql
-- apps/database/supabase/migrations/20260623000003_smp_subscription_plans.sql

CREATE TABLE public.subscription_plans (
  id            uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name          text        NOT NULL,
  duration_days int         NOT NULL CHECK (duration_days > 0),
  price_dt      numeric     NOT NULL CHECK (price_dt >= 0),
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default plans matching Synapse pricing
INSERT INTO public.subscription_plans (name, duration_days, price_dt) VALUES
  ('Journalier',     1,   6),
  ('Demi-journée',   1,   5),
  ('Semaine',        7,  25),
  ('Deux semaines', 14,  40),
  ('Mensuel',       30,  70),
  ('Trimestriel',   90, 180);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read active plans
CREATE POLICY "subscription_plans_select" ON public.subscription_plans
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admin only: insert/update/delete
CREATE POLICY "subscription_plans_insert" ON public.subscription_plans
  FOR INSERT WITH CHECK (current_user_role() = 'admin');

CREATE POLICY "subscription_plans_update" ON public.subscription_plans
  FOR UPDATE USING (current_user_role() = 'admin');

CREATE POLICY "subscription_plans_delete" ON public.subscription_plans
  FOR DELETE USING (current_user_role() = 'admin');
```

- [ ] **Step 2: Commit**

```bash
git add apps/database/supabase/migrations/20260623000003_smp_subscription_plans.sql
git commit -m "feat(db): add subscription_plans table with default Synapse plans"
```

---

### Task 4: Subscriptions table

**Files:**
- Create: `apps/database/supabase/migrations/20260623000004_smp_subscriptions.sql`

- [ ] **Step 1: Write migration**

```sql
-- apps/database/supabase/migrations/20260623000004_smp_subscriptions.sql

CREATE TABLE public.subscriptions (
  id            uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  student_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id       uuid        NOT NULL REFERENCES public.subscription_plans(id),
  start_date    date        NOT NULL DEFAULT CURRENT_DATE,
  -- end_date always computed by application: start_date + plan.duration_days
  end_date      date        NOT NULL,
  paid_amount   numeric     NOT NULL CHECK (paid_amount >= 0),
  sold_by       uuid        NOT NULL REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for fast active-subscription lookups
CREATE INDEX subscriptions_student_end_date_idx
  ON public.subscriptions (student_id, end_date DESC);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Students read own subscriptions
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT USING (
    student_id = auth.uid()
    OR current_user_role() IN ('admin', 'employee')
  );

-- Admin or employee can insert (sell subscription)
CREATE POLICY "subscriptions_insert" ON public.subscriptions
  FOR INSERT WITH CHECK (current_user_role() IN ('admin', 'employee'));

-- Admin only: update/delete
CREATE POLICY "subscriptions_update" ON public.subscriptions
  FOR UPDATE USING (current_user_role() = 'admin');

CREATE POLICY "subscriptions_delete" ON public.subscriptions
  FOR DELETE USING (current_user_role() = 'admin');
```

- [ ] **Step 2: Commit**

```bash
git add apps/database/supabase/migrations/20260623000004_smp_subscriptions.sql
git commit -m "feat(db): add subscriptions table with RLS"
```

---

### Task 5: Settings + account_categories tables

**Files:**
- Create: `apps/database/supabase/migrations/20260623000005_smp_settings.sql`

- [ ] **Step 1: Write migration**

```sql
-- apps/database/supabase/migrations/20260623000005_smp_settings.sql

CREATE TABLE public.settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);

INSERT INTO public.settings (key, value) VALUES
  ('reservation_hold_minutes',    '30'),
  ('exam_mode',                   'false'),
  ('priority_min_duration_days',  '30');

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read settings
CREATE POLICY "settings_select" ON public.settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admin only: write
CREATE POLICY "settings_write" ON public.settings
  FOR ALL USING (current_user_role() = 'admin');

-- Account categories (income / expense)
CREATE TABLE public.account_categories (
  id          uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  type        text        NOT NULL CHECK (type IN ('income', 'expense')),
  name        text        NOT NULL,
  description text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.account_categories (type, name, description) VALUES
  ('income',  'Abonnements',    'Revenus des abonnements'),
  ('income',  'Ventes en magasin', 'Snacks, boissons, fournitures'),
  ('expense', 'Loyer',          NULL),
  ('expense', 'Salaires',       NULL),
  ('expense', 'Électricité',    NULL),
  ('expense', 'Fournitures',    NULL);

-- Set default subscription income category in settings
INSERT INTO public.settings (key, value)
SELECT 'subscription_income_category_id', id::text
FROM public.account_categories
WHERE name = 'Abonnements'
LIMIT 1;

ALTER TABLE public.account_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_categories_select" ON public.account_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "account_categories_write" ON public.account_categories
  FOR ALL USING (current_user_role() = 'admin');
```

- [ ] **Step 2: Commit**

```bash
git add apps/database/supabase/migrations/20260623000005_smp_settings.sql
git commit -m "feat(db): add settings and account_categories tables"
```

---

### Task 6: Apply migrations + regenerate types

**Files:**
- Modify: `apps/web/src/lib/database.types.ts` (regenerated)

- [ ] **Step 1: Start local Supabase**

```bash
pnpm database#start
```

Wait for output showing `API URL`, `DB URL`, and keys. Then:

```bash
pnpm database#status
```

Expected: all services running.

- [ ] **Step 2: Sync env**

```bash
pnpm supabase:sync-env
```

- [ ] **Step 3: Apply migrations**

```bash
cd apps/database && pnpm supabase db reset
```

`db reset` drops and recreates the local DB, applying all migrations in order. Expected output ends with: `Finished supabase db reset`.

- [ ] **Step 4: Verify tables exist**

```bash
cd apps/database && pnpm supabase db diff --use-migra
```

Expected: empty diff (all migrations applied, schema matches).

- [ ] **Step 5: Regenerate TypeScript types**

```bash
cd /home/sah/Synapse && pnpm gen-types-local
```

Expected: `apps/web/src/lib/database.types.ts` updated. Verify the file contains `profiles`, `subscriptions`, `subscription_plans`, `settings`, `account_categories` table types.

- [ ] **Step 6: Commit regenerated types**

```bash
git add apps/web/src/lib/database.types.ts
git commit -m "feat(db): regenerate types after Phase 1A migrations"
```
