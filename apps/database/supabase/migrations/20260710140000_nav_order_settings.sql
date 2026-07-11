-- apps/database/supabase/migrations/20260710140000_nav_order_settings.sql

-- Default nav order/visibility for the employee role, mirrors EMPLOYEE_NAV_ITEMS
-- in apps/web/src/lib/nav-items.ts. Admin can edit via /admin/settings/navigation.
INSERT INTO public.settings (key, value) VALUES
  ('nav_order_employee', '[
    {"key":"/employee/dashboard","hidden":false},
    {"key":"/employee/checkin","hidden":false},
    {"key":"/employee/attendance","hidden":false},
    {"key":"/employee/students","hidden":false},
    {"key":"/employee/shifts","hidden":false},
    {"key":"/employee/rooms","hidden":false},
    {"key":"/employee/reservations","hidden":false},
    {"key":"/employee/pos","hidden":false},
    {"key":"/employee/loyalty-requests","hidden":false},
    {"key":"/employee/reports","hidden":false},
    {"key":"/employee/announcements","hidden":false},
    {"key":"/employee/profile","hidden":false}
  ]'),
  ('nav_order_admin', '[
    {"key":"/admin/dashboard","hidden":false},
    {"key":"/employee/checkin","hidden":false},
    {"key":"/employee/attendance","hidden":false},
    {"key":"/employee/students","hidden":false},
    {"key":"/employee/rooms","hidden":false},
    {"key":"/employee/reservations","hidden":false},
    {"key":"/employee/pos","hidden":false},
    {"key":"/employee/loyalty-requests","hidden":false},
    {"key":"/employee/announcements","hidden":false},
    {"key":"/admin/employees","hidden":false},
    {"key":"/admin/subscription-plans","hidden":false},
    {"key":"/admin/rooms","hidden":false},
    {"key":"/admin/products","hidden":false},
    {"key":"/admin/pos/sessions","hidden":false},
    {"key":"/admin/loyalty","hidden":false},
    {"key":"/admin/notifications/trigger","hidden":false},
    {"key":"/admin/settings","hidden":false}
  ]')
ON CONFLICT (key) DO NOTHING;
