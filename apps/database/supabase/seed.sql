-- Seed demo users for local development
-- The handle_new_user trigger auto-creates a profiles row for each insert.
INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change, created_at, updated_at)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'admin@synapse.local',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin User"}',
    crypt('Password123!', gen_salt('bf')),
    NOW(), '', '', '', '', NOW(), NOW()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'employee@synapse.local',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Employee User"}',
    crypt('Password123!', gen_salt('bf')),
    NOW(), '', '', '', '', NOW(), NOW()
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'student@synapse.local',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Student User"}',
    crypt('Password123!', gen_salt('bf')),
    NOW(), '', '', '', '', NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Auth identities (required for email/password login)
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'admin@synapse.local',    '11111111-1111-4111-8111-111111111111', '{"sub":"11111111-1111-4111-8111-111111111111","email":"admin@synapse.local"}',    'email', NOW(), NOW(), NOW()),
  ('22222222-2222-4222-8222-222222222222', 'employee@synapse.local', '22222222-2222-4222-8222-222222222222', '{"sub":"22222222-2222-4222-8222-222222222222","email":"employee@synapse.local"}', 'email', NOW(), NOW(), NOW()),
  ('33333333-3333-4333-8333-333333333333', 'student@synapse.local',  '33333333-3333-4333-8333-333333333333', '{"sub":"33333333-3333-4333-8333-333333333333","email":"student@synapse.local"}',  'email', NOW(), NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Elevate roles (trigger creates all as 'student' by default)
UPDATE public.profiles SET role = 'admin'    WHERE id = '11111111-1111-4111-8111-111111111111';
UPDATE public.profiles SET role = 'employee' WHERE id = '22222222-2222-4222-8222-222222222222';

-- ============================================================
-- Extra demo students + activity data, to populate admin stats
-- ============================================================

INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change, created_at, updated_at)
VALUES
  ('44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'youssef.sahnoun@synapse.local', '{"provider":"email","providers":["email"]}', '{"full_name":"Youssef Sahnoun"}', crypt('Password123!', gen_salt('bf')), NOW(), '', '', '', '', NOW(), NOW()),
  ('55555555-5555-4555-8555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ines.bensalah@synapse.local',  '{"provider":"email","providers":["email"]}', '{"full_name":"Ines Ben Salah"}',  crypt('Password123!', gen_salt('bf')), NOW(), '', '', '', '', NOW(), NOW()),
  ('66666666-6666-4666-8666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'omar.trabelsi@synapse.local',  '{"provider":"email","providers":["email"]}', '{"full_name":"Omar Trabelsi"}',   crypt('Password123!', gen_salt('bf')), NOW(), '', '', '', '', NOW(), NOW()),
  ('77777777-7777-4777-8777-777777777777', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rania.gharbi@synapse.local',   '{"provider":"email","providers":["email"]}', '{"full_name":"Rania Gharbi"}',    crypt('Password123!', gen_salt('bf')), NOW(), '', '', '', '', NOW(), NOW()),
  ('88888888-8888-4888-8888-888888888888', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amine.cherif@synapse.local',   '{"provider":"email","providers":["email"]}', '{"full_name":"Amine Cherif"}',    crypt('Password123!', gen_salt('bf')), NOW(), '', '', '', '', NOW(), NOW()),
  ('99999999-9999-4999-8999-999999999999', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'salma.jendoubi@synapse.local', '{"provider":"email","providers":["email"]}', '{"full_name":"Salma Jendoubi"}',  crypt('Password123!', gen_salt('bf')), NOW(), '', '', '', '', NOW(), NOW()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'karim.bouazizi@synapse.local', '{"provider":"email","providers":["email"]}', '{"full_name":"Karim Bouazizi"}',  crypt('Password123!', gen_salt('bf')), NOW(), '', '', '', '', NOW(), NOW()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nour.mansour@synapse.local',   '{"provider":"email","providers":["email"]}', '{"full_name":"Nour Mansour"}',    crypt('Password123!', gen_salt('bf')), NOW(), '', '', '', '', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  ('44444444-4444-4444-8444-444444444444', 'youssef.sahnoun@synapse.local', '44444444-4444-4444-8444-444444444444', '{"sub":"44444444-4444-4444-8444-444444444444","email":"youssef.sahnoun@synapse.local"}', 'email', NOW(), NOW(), NOW()),
  ('55555555-5555-4555-8555-555555555555', 'ines.bensalah@synapse.local',  '55555555-5555-4555-8555-555555555555', '{"sub":"55555555-5555-4555-8555-555555555555","email":"ines.bensalah@synapse.local"}',  'email', NOW(), NOW(), NOW()),
  ('66666666-6666-4666-8666-666666666666', 'omar.trabelsi@synapse.local',  '66666666-6666-4666-8666-666666666666', '{"sub":"66666666-6666-4666-8666-666666666666","email":"omar.trabelsi@synapse.local"}',  'email', NOW(), NOW(), NOW()),
  ('77777777-7777-4777-8777-777777777777', 'rania.gharbi@synapse.local',   '77777777-7777-4777-8777-777777777777', '{"sub":"77777777-7777-4777-8777-777777777777","email":"rania.gharbi@synapse.local"}',   'email', NOW(), NOW(), NOW()),
  ('88888888-8888-4888-8888-888888888888', 'amine.cherif@synapse.local',   '88888888-8888-4888-8888-888888888888', '{"sub":"88888888-8888-4888-8888-888888888888","email":"amine.cherif@synapse.local"}',   'email', NOW(), NOW(), NOW()),
  ('99999999-9999-4999-8999-999999999999', 'salma.jendoubi@synapse.local', '99999999-9999-4999-8999-999999999999', '{"sub":"99999999-9999-4999-8999-999999999999","email":"salma.jendoubi@synapse.local"}', 'email', NOW(), NOW(), NOW()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'karim.bouazizi@synapse.local', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","email":"karim.bouazizi@synapse.local"}', 'email', NOW(), NOW(), NOW()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'nour.mansour@synapse.local',   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","email":"nour.mansour@synapse.local"}',   'email', NOW(), NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Rooms + seats
INSERT INTO public.rooms (id, name, capacity) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Salle Alpha', 20),
  ('a0000000-0000-4000-8000-000000000002', 'Salle Beta', 15)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seats (id, room_id, label, position_x, position_y) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'A1', 0, 0),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'A2', 1, 0),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'A3', 2, 0),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', 'B1', 0, 0),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002', 'B2', 1, 0),
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000002', 'B3', 2, 0)
ON CONFLICT (id) DO NOTHING;

-- Products
INSERT INTO public.products (id, name, category, price_dt, stock_quantity, is_active) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'Café', 'boisson', 2.5, 200, true),
  ('c0000000-0000-4000-8000-000000000002', 'Thé', 'boisson', 2, 150, true),
  ('c0000000-0000-4000-8000-000000000003', 'Eau', 'boisson', 1, 300, true),
  ('c0000000-0000-4000-8000-000000000004', 'Croissant', 'snack', 3, 80, true),
  ('c0000000-0000-4000-8000-000000000005', 'Sandwich', 'snack', 7, 50, true),
  ('c0000000-0000-4000-8000-000000000006', 'Cookie', 'snack', 2.5, 100, true)
ON CONFLICT (id) DO NOTHING;

-- Subscriptions
INSERT INTO public.subscriptions (student_id, plan_id, start_date, paid_amount, sold_by)
SELECT s.student_id, p.id, s.start_date, p.price_dt, '22222222-2222-4222-8222-222222222222'
FROM (VALUES
  ('44444444-4444-4444-8444-444444444444'::uuid, 'Mensuel',       CURRENT_DATE - 10),
  ('55555555-5555-4555-8555-555555555555'::uuid, 'Semaine',       CURRENT_DATE - 3),
  ('66666666-6666-4666-8666-666666666666'::uuid, 'Trimestriel',   CURRENT_DATE - 20),
  ('77777777-7777-4777-8777-777777777777'::uuid, 'Deux semaines', CURRENT_DATE - 5),
  ('88888888-8888-4888-8888-888888888888'::uuid, 'Mensuel',       CURRENT_DATE - 15),
  ('99999999-9999-4999-8999-999999999999'::uuid, 'Journalier',    CURRENT_DATE),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'Semaine',       CURRENT_DATE - 6),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 'Mensuel',       CURRENT_DATE - 25)
) AS s(student_id, plan_name, start_date)
JOIN public.subscription_plans p ON p.name = s.plan_name;

INSERT INTO public.loyalty_ledger (student_id, points_delta, reason, ref_id)
SELECT student_id, floor(paid_amount)::int, 'subscription', id
FROM public.subscriptions
WHERE student_id IN (
  '44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666', '77777777-7777-4777-8777-777777777777',
  '88888888-8888-4888-8888-888888888888', '99999999-9999-4999-8999-999999999999',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
);

-- Attendance history over the last ~12 days, 0-2 sessions/day/student
DO $$
DECLARE
  v_students uuid[] := ARRAY[
    '44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555',
    '66666666-6666-4666-8666-666666666666', '77777777-7777-4777-8777-777777777777',
    '88888888-8888-4888-8888-888888888888', '99999999-9999-4999-8999-999999999999',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ];
  v_seats uuid[] := ARRAY[
    'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000004',
    'b0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000006'
  ];
  v_rooms uuid[] := ARRAY[
    'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002'
  ];
  v_student uuid;
  v_day int;
  v_sessions int;
  v_j int;
  v_checkin timestamptz;
  v_duration interval;
  v_seat_idx int;
BEGIN
  FOR v_i IN 1..array_length(v_students, 1) LOOP
    v_student := v_students[v_i];
    FOR v_day IN 1..12 LOOP
      IF random() < 0.3 THEN CONTINUE; END IF;
      v_sessions := 1 + floor(random() * 2)::int;
      FOR v_j IN 1..v_sessions LOOP
        v_checkin := (CURRENT_DATE - v_day) + make_interval(hours => 8 + floor(random() * 10)::int, mins => floor(random() * 60)::int);
        v_duration := make_interval(hours => 1 + floor(random() * 4)::int, mins => floor(random() * 60)::int);
        v_seat_idx := 1 + floor(random() * array_length(v_seats, 1))::int;
        INSERT INTO public.attendance (student_id, seat_id, room_id, checked_in_at, checked_out_at, entry_method)
        VALUES (
          v_student,
          v_seats[v_seat_idx],
          v_rooms[((v_seat_idx - 1) / 3) + 1],
          v_checkin,
          v_checkin + v_duration,
          'qr_scan'
        );
      END LOOP;
    END LOOP;
  END LOOP;

  -- A couple of students currently checked in (open sessions, for live occupancy)
  INSERT INTO public.attendance (student_id, seat_id, room_id, checked_in_at, entry_method) VALUES
    ('44444444-4444-4444-8444-444444444444', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', now() - interval '90 minutes', 'qr_scan'),
    ('77777777-7777-4777-8777-777777777777', 'b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', now() - interval '40 minutes', 'qr_scan');

  UPDATE public.seats SET status = 'occupied' WHERE id IN ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004');
END $$;

-- POS purchases over the last ~10 days
DO $$
DECLARE
  v_students uuid[] := ARRAY[
    '44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555',
    '66666666-6666-4666-8666-666666666666', '77777777-7777-4777-8777-777777777777',
    '88888888-8888-4888-8888-888888888888', '99999999-9999-4999-8999-999999999999',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ];
  v_products uuid[] := ARRAY[
    'c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000004',
    'c0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000006'
  ];
  v_prices numeric[] := ARRAY[2.5, 2, 1, 3, 7, 2.5];
  v_employee uuid := '22222222-2222-4222-8222-222222222222';
  v_student uuid;
  v_day int;
  v_purchase_id uuid;
  v_total numeric;
  v_num_items int;
  v_j int;
  v_pidx int;
  v_qty int;
  v_created timestamptz;
BEGIN
  FOR v_i IN 1..array_length(v_students, 1) LOOP
    v_student := v_students[v_i];
    FOR v_day IN 0..9 LOOP
      IF random() < 0.6 THEN CONTINUE; END IF;
      v_created := (CURRENT_DATE - v_day) + make_interval(hours => 9 + floor(random() * 10)::int, mins => floor(random() * 60)::int);

      INSERT INTO public.purchases (student_id, sold_by, total_dt, created_at)
      VALUES (v_student, v_employee, 0, v_created)
      RETURNING id INTO v_purchase_id;

      v_total := 0;
      v_num_items := 1 + floor(random() * 2)::int;
      FOR v_j IN 1..v_num_items LOOP
        v_pidx := 1 + floor(random() * array_length(v_products, 1))::int;
        v_qty := 1 + floor(random() * 2)::int;

        INSERT INTO public.purchase_items (purchase_id, product_id, quantity, unit_price_dt, created_at)
        VALUES (v_purchase_id, v_products[v_pidx], v_qty, v_prices[v_pidx], v_created);

        v_total := v_total + (v_prices[v_pidx] * v_qty);

        UPDATE public.products SET stock_quantity = GREATEST(stock_quantity - v_qty, 0) WHERE id = v_products[v_pidx];

        INSERT INTO public.pos_activity_log (action, product_id, actor_id, quantity, amount_dt, details, created_at)
        VALUES ('sale', v_products[v_pidx], v_employee, v_qty, v_prices[v_pidx] * v_qty, jsonb_build_object('purchase_id', v_purchase_id), v_created);
      END LOOP;

      UPDATE public.purchases SET total_dt = v_total WHERE id = v_purchase_id;

      IF floor(v_total)::int > 0 THEN
        INSERT INTO public.loyalty_ledger (student_id, points_delta, reason, ref_id, created_at)
        VALUES (v_student, floor(v_total)::int, 'purchase', v_purchase_id, v_created);
      END IF;
    END LOOP;
  END LOOP;
END $$;
