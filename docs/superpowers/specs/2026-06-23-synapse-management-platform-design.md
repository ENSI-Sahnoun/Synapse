# Synapse Management Platform — Design Spec

**Date:** 2026-06-23  
**Version:** 1.0  
**Client:** Synapse Meeting Space, Sfax, Tunisie  
**Stack:** NextBase starter (Next.js 16 + Supabase), PWA, French UI (Arabic planned for v2)

---

## 1. Overview

A single web platform replacing Loyverse POS, Google Sheets, and manual attendance tracking at Synapse Meeting Space — a co-working space and study library with ~60 seats across multiple rooms, serving primarily university students.

**Three user roles:** Admin (owner), Employee (front desk), Student (client).  
**Payments:** Cash only.  
**Language:** French (v1), Arabic (v2).

---

## 2. Architecture

### Approach

Single Next.js app (NextBase starter) extended with role-based route groups. No separate apps. Student PWA is the same app with a mobile-optimized route group.

### Route Groups

```
apps/web/src/app/
├── (auth-pages)/           # Login + student self-signup
├── (admin-pages)/          # Owner: full access
├── (employee-pages)/       # Staff: check-in, subscriptions, POS, attendance
├── (student-pages)/        # Students: PWA shell — QR, reservation, loyalty
└── kiosk/                  # Standalone fullscreen check-in terminal
```

### Auth & Roles

- Supabase Auth handles all users.
- Role stored in `profiles.role` (`admin | employee | student`).
- Middleware reads role → redirects to correct route group.
- Students: self-signup (email or phone) or created by employee.
- Employees: created by admin only.
- Admins: seeded or created by admin only.

### RLS Boundaries

| Role | Can read | Can write |
|---|---|---|
| Student | Own profile, subscription, attendance, loyalty, notifications | Own reservation (create only) |
| Employee | All students, subscriptions, attendance, products, purchases, rooms/seats, notifications | All of above + expenses |
| Admin | Everything | Everything |

### Supabase Clients (unchanged from NextBase)

- `supabase-clients/server.ts` — RSC + server actions
- `supabase-clients/middleware.ts` — session verification + role-based redirect
- `supabase-clients/client.ts` — Realtime seat map subscriptions

---

## 3. Database Schema

### Core Tables

```sql
-- Extends Supabase auth.users
profiles (
  id uuid PK references auth.users,
  role text CHECK (role IN ('admin','employee','student')),
  full_name text,
  phone text,
  university text,          -- students only
  study_level text,         -- students only
  qr_token text UNIQUE,     -- generated on student profile creation
  created_at timestamptz
)

-- Admin-configurable subscription plans
subscription_plans (
  id uuid PK,
  name text,                -- e.g. "Mensuel", "Journalier"
  duration_days int,
  price_dt numeric,
  is_active boolean,
  created_at timestamptz
)

-- Student subscriptions
subscriptions (
  id uuid PK,
  student_id uuid references profiles,
  plan_id uuid references subscription_plans,
  start_date date,
  end_date date,            -- auto-computed: start_date + plan.duration_days
  paid_amount numeric,
  sold_by uuid references profiles,  -- employee who sold it
  created_at timestamptz
)

-- Rooms
rooms (
  id uuid PK,
  name text,
  capacity int,
  status text CHECK (status IN ('open','closed','reserved')),
  status_note text,
  created_at timestamptz
)

-- Seats (positions set via drag-and-drop editor)
seats (
  id uuid PK,
  room_id uuid references rooms,
  label text,               -- e.g. "A1", "B3"
  position_x numeric,
  position_y numeric,
  status text CHECK (status IN ('free','occupied','reserved','out_of_service')),
)

-- Check-in/out log
attendance (
  id uuid PK,
  student_id uuid references profiles,
  seat_id uuid references seats,
  room_id uuid references rooms,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  entry_method text CHECK (entry_method IN ('qr_scan','manual'))
)

-- Seat reservations
reservations (
  id uuid PK,
  student_id uuid references profiles,
  seat_id uuid references seats,
  reserved_at timestamptz,
  expires_at timestamptz,   -- reserved_at + settings.reservation_hold_minutes
  status text CHECK (status IN ('active','expired','fulfilled')),
  queue_position int        -- exam mode only
)

-- Admin-managed product inventory
products (
  id uuid PK,
  name text,
  category text,
  price_dt numeric,
  stock_quantity int,
  account_category_id uuid references account_categories,
  is_active boolean,
  created_at timestamptz
)

-- In-store purchases
purchases (
  id uuid PK,
  student_id uuid references profiles,  -- nullable (anonymous)
  sold_by uuid references profiles,
  total_dt numeric,
  created_at timestamptz
)

purchase_items (
  id uuid PK,
  purchase_id uuid references purchases,
  product_id uuid references products,
  quantity int,
  unit_price_dt numeric
)

-- Loyalty append-only ledger (balance = SUM of points_delta per student)
loyalty_ledger (
  id uuid PK,
  student_id uuid references profiles,
  points_delta int,         -- positive = earned, negative = redeemed
  reason text,              -- 'subscription', 'purchase', 'redemption'
  ref_id uuid,              -- references subscriptions or purchases
  created_at timestamptz
)

-- Admin-configurable loyalty rewards
loyalty_rules (
  id uuid PK,
  name text,
  reward_type text,         -- 'free_day' | 'free_coffee' | 'discount_pct'
  points_threshold int,
  reward_value numeric,     -- e.g. discount percentage
  is_active boolean
)

-- In-app notifications
notifications (
  id uuid PK,
  user_id uuid references profiles,
  type text,
  message text,
  read_at timestamptz,
  created_at timestamptz
)

-- Configurable chart of accounts
account_categories (
  id uuid PK,
  type text CHECK (type IN ('income','expense')),
  name text,
  description text,
  is_active boolean,
  created_at timestamptz
)

-- Manual expense entries
expenses (
  id uuid PK,
  account_category_id uuid references account_categories,
  description text,
  amount_dt numeric,
  date date,
  created_by uuid references profiles,
  created_at timestamptz
)

-- Admin-defined dashboard metrics with targets
custom_metrics (
  id uuid PK,
  name text,
  unit text,
  target_value numeric,
  is_dashboard_visible boolean,
  created_at timestamptz
)

-- Global app settings (key-value)
settings (
  key text PK,
  value text
  -- reservation_hold_minutes   default '30'
  -- exam_mode                  default 'false'
  -- priority_min_duration_days default '30'
  -- subscription_income_category_id
)
```

### Key Invariants

- `subscriptions.end_date` always computed on insert (`start_date + plan.duration_days`), never manually set.
- Loyalty balance never stored — always `SELECT SUM(points_delta) FROM loyalty_ledger WHERE student_id = ?`.
- Subscription cancellation/modification: employee and admin only. Students have no write access to `subscriptions`.
- One active reservation per student enforced at DB level (partial unique index on `student_id` WHERE `status = 'active'`).

---

## 4. QR Code & Check-in

### QR Token

Generated server-side on student profile creation:
```
SYNAPSE-{student_id}-{hmac_sha256(student_id, SECRET_KEY)}
```
Stored in `profiles.qr_token`. Displayed in student PWA and printable as physical card. Signature prevents forgery — server validates HMAC before any check-in action.

### Scan Modes

**Employee device** (`/employee/checkin`):
- Browser camera via `getUserMedia()` + `zxing-js`
- Employee scans student's phone screen or printed card

**Self-serve kiosk** (`/kiosk`):
- Fullscreen, no navigation
- Runs under a dedicated employee-role service session pinned to the device
- Same scan → verify → respond pipeline

### Check-in Server Action Response

| Result | Display |
|---|---|
| `AUTHORIZED` | Student name, plan name, expiry date, days remaining (green) |
| `DENIED_EXPIRED` | Student name, expiry date (red) |
| `DENIED_NO_SUB` | No active subscription found (red) |
| `DENIED_UNKNOWN` | QR not recognized (red) |
| `ALREADY_IN` | Student already checked in — idempotent (yellow) |

Check-in logs to `attendance`. Seat assigned at check-in (from active reservation if exists, else employee/student selects).

### Check-out

Manual button in employee view, or automatic midnight sweep via `pg_cron` (sets `checked_out_at = now()` for any open attendance rows, marks seats free).

### POS QR Scan Flow

1. Employee opens `/employee/pos`
2. Selects products + quantities from active product list
3. Scans student QR (optional — skip for anonymous purchase)
4. Preview: student name, cart total, points to be earned
5. Confirm → single server action:
   - Inserts `purchases` + `purchase_items`
   - Decrements `products.stock_quantity` per item
   - Inserts `loyalty_ledger` entry if student linked
   - Returns updated point balance

Stock reaches 0 → product auto-flagged unavailable in POS. Admin sees low-stock indicator on dashboard.

---

## 5. Seat Map

### Admin Editor (`/admin/rooms/[roomId]/editor`)

Built with `react-konva` (canvas-based, better than SVG for interactive drag-and-drop).

- Create/rename rooms, set capacity, set room status
- Drag seat tokens onto canvas — `position_x/y` saved on drop
- Label seats (A1, B3, etc.)
- Mark individual seats out of service
- Changes saved via server action

### Live Map (Employee + Student)

Read-only render of same canvas layout. Colors update via Supabase Realtime subscription on `seats`:

| Color | Status |
|---|---|
| Green | free |
| Red | occupied |
| Orange | reserved |
| Gray | out of service |

Employee can click any seat → manually assign a student (walk-in override).

Student can tap a green seat → initiates reservation flow.

### Room Capacity Badges

Computed from live seat counts, updated via Realtime:

| Occupancy | Badge |
|---|---|
| 0% | Empty |
| 1–40% | Quiet |
| 41–70% | Moderate |
| 71–90% | Nearly Full |
| 91–100% | Full |

### Room Status

Admin or employee can set room to `open`, `closed`, or `reserved` with optional `status_note`.  
When `closed` or `reserved`: all seats hidden from reservation UI, shown grayed out to students with status note.

---

## 6. Subscriptions

### Sale Flow (Employee)

1. Search student by name or phone
2. Select active plan
3. System shows: start date (today), computed end date, price
4. Confirm (cash collected physically) → server action:
   - Creates `subscriptions` row
   - Stacks after current `end_date` if student has active subscription (employee warned)
   - Inserts `loyalty_ledger` entry (`points_delta = floor(paid_amount)`)
   - Schedules expiry notifications (J-7, J-3, J-1)

### Rules

- Only admin or employee can create, modify, or cancel subscriptions
- Students view their subscription status only
- Plans (name, duration, price, active) fully configurable by admin

---

## 7. Reservations

- Requires logged-in student with an active subscription
- One active reservation per student (enforced by DB partial unique index)
- Hold duration = `settings.reservation_hold_minutes` (admin-adjustable, default 30)
- `pg_cron` job every 5 minutes: expires unfullfilled reservations → seat status → `free` → Realtime broadcast
- QR check-in fulfills matching active reservation → seat → `occupied`
- Students cannot cancel reservations — auto-expiry only

### Exam Mode

Toggled by admin via `settings.exam_mode = true`:
- Reservation required to complete check-in (QR denied without active reservation)
- Waitlist via `reservations.queue_position`
- Students with subscriptions ≥ `settings.priority_min_duration_days` (default 30) jump queue

---

## 8. Notifications

### Channels

| Channel | Provider |
|---|---|
| Email | Resend |
| SMS | Twilio or local Tunisian gateway |
| WhatsApp | Meta WhatsApp Business Cloud API |

Admin toggles which channels are active per notification type from settings panel.

### Triggers

| Event | Timing | Default channels |
|---|---|---|
| Subscription expiry warning | J-7, J-3, J-1 | Email + WhatsApp |
| Subscription expired | Day 0 | SMS + WhatsApp |
| Renewal reminder (no action) | J+3 | WhatsApp |
| Reservation confirmed | Instant | In-app |
| Reservation expiring soon | 5 min before | In-app |
| Points earned | Instant | In-app |

In-app notifications stored in `notifications` table, displayed as bell icon in student PWA and employee nav.

---

## 9. Loyalty (Points Synapse)

**Earning:** 1 DT spent = 1 point. Applies to subscriptions and in-store purchases. Anonymous purchases earn no points.

**Ledger:** append-only `loyalty_ledger`. Balance always computed as `SUM(points_delta)` — never a stored column.

**Rewards:** defined in `loyalty_rules` (threshold, reward type, reward value). Admin can add/modify/deactivate any rule.

**Redemption flow:**
1. Student sees redeemable rewards in PWA
2. Student requests redemption
3. Employee validates physically (hands over reward)
4. Employee confirms in system → negative `loyalty_ledger` entry logged

---

## 10. Dashboard

**Live indicators (Supabase Realtime):**
- Students currently inside (count + list)
- Seat occupancy (e.g. 42/60)
- Today's revenue (subscriptions + purchases)
- Subscriptions expiring this week
- Low-stock products

**Daily summary cards:**
- New students registered
- Subscriptions sold + revenue
- In-store sales revenue
- Total footfall

**Charts (via `recharts`):**
- Revenue over time (line)
- New vs returning students (bar)
- Most popular subscription plan (pie)
- Custom metrics with target lines (defined in `custom_metrics` table)

**Admin-only:** all stats, all exports, accounting view, settings.

---

## 11. Accounting

### Chart of Accounts

Fully admin-configurable via `account_categories`. No hardcoded categories. Admin adds, renames, or deactivates income/expense categories at any time.

Auto-linking:
- `subscriptions` → income category set in `settings.subscription_income_category_id`
- `products` → each product assigned an `account_category_id` at creation

### Expense Entry

Manual entry by admin: category, description, amount, date.

### P&L Computation

```
Revenue  = SUM(subscriptions.paid_amount) + SUM(purchases.total_dt)
Expenses = SUM(expenses.amount_dt)
Profit   = Revenue - Expenses
```

Filterable by day, month, or custom date range.

### Exports

- PDF via `@react-pdf/renderer`
- Excel via `xlsx`

Report structure mirrors live `account_categories` — new category automatically appears as a row in all future reports.

---

## 12. Student PWA

Route group: `(student-pages)/`. Mobile-optimized. PWA manifest added to Next.js app for "Add to Home Screen" on Android and iOS.

**Features:**
- View active subscription (plan, expiry, days remaining)
- Display personal QR code (fullscreen-friendly)
- View live seat map (read-only, tap green seat to reserve)
- View loyalty point balance + redeemable rewards
- Request loyalty redemption
- View in-app notifications

No native app. No app store. Push notifications delivered via WhatsApp/SMS (bypasses iOS PWA push limitations).

---

## 13. Development Phases

| Phase | Scope |
|---|---|
| 1 | Student profiles, subscription plans, subscription sales, employee + admin auth |
| 2 | QR token generation, check-in (employee device + kiosk), attendance logging |
| 3 | Room + seat management, drag-and-drop map editor, Realtime seat status |
| 4 | Reservation engine, exam mode, pg_cron expiry jobs |
| 5 | Loyalty ledger, rewards, redemption flow |
| 6 | Notifications (email, SMS, WhatsApp), in-app notification bell |
| 7 | Dashboard charts, accounting, P&L, exports, custom metrics |

Student PWA built in parallel with Phase 1 (auth + QR display) and extended each phase.

---

## 14. Key Libraries (additions to NextBase starter)

| Purpose | Library |
|---|---|
| QR scanning | `zxing-js` |
| QR generation | `qrcode` |
| Seat map canvas | `react-konva` |
| Charts | `recharts` |
| PDF export | `@react-pdf/renderer` |
| Excel export | `xlsx` |
| Notifications (email) | Resend SDK |
| Notifications (SMS/WA) | Twilio SDK / Meta Cloud API |
