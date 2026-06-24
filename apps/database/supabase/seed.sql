-- Seed demo users for local development
-- The handle_new_user trigger auto-creates a profiles row for each insert.
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    'admin@synapse.local',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin User"}',
    crypt('Password123!', gen_salt('bf')),
    NOW(), NOW(), NOW()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'employee@synapse.local',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Employee User"}',
    crypt('Password123!', gen_salt('bf')),
    NOW(), NOW(), NOW()
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'student@synapse.local',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Student User"}',
    crypt('Password123!', gen_salt('bf')),
    NOW(), NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Elevate roles (trigger creates all as 'student' by default)
UPDATE public.profiles SET role = 'admin'    WHERE id = '11111111-1111-4111-8111-111111111111';
UPDATE public.profiles SET role = 'employee' WHERE id = '22222222-2222-4222-8222-222222222222';
