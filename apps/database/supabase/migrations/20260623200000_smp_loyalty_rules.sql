-- Loyalty rules table
CREATE TABLE public.loyalty_rules (
  id                uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name              text        NOT NULL UNIQUE,
  reward_type       text        NOT NULL CHECK (reward_type IN ('free_day', 'free_coffee', 'discount_pct')),
  points_threshold  int         NOT NULL CHECK (points_threshold > 0),
  reward_value      int         NOT NULL DEFAULT 0,
  is_active         boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Seed default loyalty rules
INSERT INTO public.loyalty_rules (name, reward_type, points_threshold, reward_value, is_active)
SELECT name, reward_type, points_threshold, reward_value, true
FROM (VALUES
  ('Journée gratuite',  'free_day',      70, 0),
  ('Café offert',       'free_coffee',   30, 0),
  ('Réduction 10%',     'discount_pct',  50, 10)
) AS defaults(name, reward_type, points_threshold, reward_value)
WHERE NOT EXISTS (SELECT 1 FROM public.loyalty_rules LIMIT 1);
