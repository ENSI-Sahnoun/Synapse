# Synapse UI Design System

**Date:** 2026-06-24
**Applies to:** All route groups — admin, employee, student PWA, kiosk
**Stack:** Next.js + Tailwind CSS v4, shadcn/ui, Phosphor Icons, DM Sans + DM Serif Display

---

## 1. Design Direction

**Style:** Clean & professional with warm neutral personality.
Inspired by premium co-working and editorial SaaS tools (Notion, Linear).
Warm brown/orange/white palette — not cold, not playful. Authoritative yet approachable for university students.

---

## 2. Color Palette

| Token | Value | Use |
|---|---|---|
| `--background` | `#FAFAF8` | App background (warm off-white) |
| `--surface` | `#FFFFFF` | Cards, modals, panels |
| `--sidebar-bg` | `#2C1A0E` | Dark brown sidebar (admin + employee) |
| `--sidebar-text` | `#F5EDE3` | Sidebar nav text |
| `--sidebar-muted` | `#A08060` | Sidebar secondary text |
| `--primary` | `#C4622D` | Burnt orange — buttons, active nav, badges |
| `--primary-hover` | `#A8501F` | Button hover state |
| `--primary-light` | `#FDF0E8` | Active nav background, tag/chip backgrounds |
| `--border` | `#E8DDD4` | Warm beige card/input borders |
| `--muted` | `#8C7B6E` | Secondary text, placeholders |
| `--foreground` | `#1C1009` | Primary text (near-black warm) |
| `--destructive` | `#DC2626` | Errors, delete actions |
| `--success` | `#16A34A` | Active subscription, check-in success |
| `--warning` | `#D97706` | Expiring soon, reserved seats |
| `--chart-1` | `#C4622D` | Primary data series |
| `--chart-2` | `#F59E0B` | Secondary data series |
| `--chart-3` | `#16A34A` | Tertiary data series |
| `--chart-4` | `#6B7280` | Quaternary data series |

### Dark sidebar color scale (oklch equivalents for Tailwind v4)

The sidebar dark brown `#2C1A0E` and accent burnt orange `#C4622D` must be added as custom CSS variables in `globals.css` and mapped to Tailwind utilities.

---

## 3. Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| Display / hero headings | DM Serif Display | 400 | 32–48px |
| Page titles (h1) | DM Sans | 700 | 24–28px |
| Section headings (h2–h3) | DM Sans | 600 | 18–20px |
| UI labels, nav, buttons | DM Sans | 500 | 14px |
| Body / table content | DM Sans | 400 | 14–15px |
| Captions, muted text | DM Sans | 400 | 12px |
| Monospace (QR token, IDs) | `ui-monospace` system stack | 400 | 13px |

**Line height:** 1.6 for body, 1.2 for headings.
**Max line length:** 68ch for prose content.

### Loading fonts (globals.css)

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..18,400;0,9..18,500;0,9..18,600;0,9..18,700&family=DM+Serif+Display&display=swap');
```

Replace current Inter localFont with DM Sans variable in `layout.tsx`.

---

## 4. Icons

**Library:** Phosphor Icons (`@phosphor-icons/react`)

**Sizes:**
- Nav icons: 20px
- Button icons: 16px
- Hero/feature icons: 32px

**Weight:** `Regular` for nav/body, `Bold` for CTAs and status.

No emojis as icons anywhere in the UI.

---

## 5. Spacing & Layout

**Border radius:**
- Cards, panels: `8px` (`rounded-lg`)
- Buttons, inputs: `6px` (`rounded-md`)
- Badges, chips: `4px` (`rounded`)
- Avatars: `50%` (`rounded-full`)

**Shadows:**
- Card: `0 1px 4px rgba(44,26,14,0.08)`
- Dropdown/modal: `0 8px 32px rgba(44,26,14,0.12)`
- Sidebar: none (full-height, border-right instead)

**Z-index scale:**
- Base content: 0
- Sticky headers: 10
- Dropdowns: 20
- Modals/dialogs: 30
- Toasts: 50

---

## 6. Admin & Employee Layout

### Sidebar

```
Width: 240px (desktop), collapsible to icon-only 64px
Background: #2C1A0E
Top: Logo "Synapse" in DM Serif Display 18px, warm white
     Subtitle "Administration" / "Employé" in 11px #A08060

Nav links:
  Default: text #F5EDE3, no background
  Hover: bg rgba(245,237,227,0.08), text #F5EDE3
  Active: bg #FDF0E8, text #C4622D, left border 2px #C4622D
  Icon: Phosphor 20px, same color as text

Bottom: User name + role, sign out link (red on hover)
```

### Main content area

```
Background: #FAFAF8
Padding: 24px (desktop)
Max width: none (full flex-1)

Page header:
  h1 in DM Sans 700 24px #1C1009
  Breadcrumb in 13px #8C7B6E
  Action buttons top-right
```

### Employee layout

Same sidebar, different nav items (check-in, subscriptions, POS, attendance).

---

## 7. Student PWA Layout

Mobile-first. Tested at 375px, 390px, 430px.

### Top bar

```
Height: 56px
Background: #FFFFFF
Border-bottom: 1px #E8DDD4
Left: "Synapse" DM Serif Display 16px #1C1009
Right: notification bell (Phosphor Bell icon) + avatar/initials circle
```

### Bottom navigation

```
Height: 64px + safe-area-inset-bottom
Background: #FFFFFF
Border-top: 1px #E8DDD4
4 tabs: Abonnement | QR Code | Réserver | Points

Tab default: Phosphor icon 22px #8C7B6E + label 11px #8C7B6E
Tab active: icon + label #C4622D
No indicator bar — color change only
```

### Page background

`#FAFAF8` — same warm off-white. Consistent brand.

---

## 8. Component Patterns

### Cards

```
bg: #FFFFFF
border: 1px solid #E8DDD4
border-radius: 8px
shadow: 0 1px 4px rgba(44,26,14,0.08)
padding: 16-24px
```

### Buttons

```
Primary:
  bg: #C4622D | hover: #A8501F
  text: white, DM Sans 500 14px
  padding: 8px 16px, radius 6px
  transition: background 150ms

Secondary:
  bg: transparent | hover: #FDF0E8
  border: 1px solid #E8DDD4
  text: #1C1009

Destructive:
  bg: #DC2626 | hover: #B91C1C
  text: white

Ghost:
  no border, no bg | hover: #FDF0E8
  text: #1C1009
```

### Form inputs

```
bg: #FFFFFF
border: 1px solid #E8DDD4 | focus: #C4622D (2px ring)
border-radius: 6px
padding: 8px 12px
text: #1C1009, placeholder: #8C7B6E
label: DM Sans 500 13px #1C1009 above input
```

### Badges / Status chips

| State | Background | Text |
|---|---|---|
| Active / Success | `#DCFCE7` | `#16A34A` |
| Expired / Error | `#FEE2E2` | `#DC2626` |
| Warning / Expiring | `#FEF3C7` | `#D97706` |
| Neutral / Inactive | `#F3F4F6` | `#6B7280` |
| Primary / Info | `#FDF0E8` | `#C4622D` |

### Tables

```
header: bg #FAFAF8, text DM Sans 500 12px uppercase #8C7B6E, border-bottom #E8DDD4
rows: bg white, hover bg #FAFAF8, border-bottom #E8DDD4 (light)
text: 14px #1C1009
action column: ghost buttons, right-aligned
```

### Seat map colors (Phase 3)

| Status | Color | Hex |
|---|---|---|
| Free | Green | `#16A34A` |
| Occupied | Warm red | `#DC2626` |
| Reserved | Amber | `#F59E0B` |
| Out of service | Muted gray | `#D1D5DB` |

---

## 9. Kiosk Layout

Fullscreen. No nav. Centered content.

```
Background: #2C1A0E (dark brown — immersive)
Logo: "Synapse" DM Serif Display 32px #F5EDE3, centered top
Scan area: white card centered, large QR icon, status message
Result states use oversized typography (48px+) for visibility at distance
  AUTHORIZED: #16A34A text
  DENIED: #DC2626 text
  ALREADY IN: #D97706 text
```

---

## 10. Implementation Plan

### CSS changes (`globals.css`)

1. Replace current neutral CSS variables with warm palette
2. Add `--sidebar-bg`, `--sidebar-text`, `--sidebar-muted`, `--primary-light`, `--success`, `--warning`
3. Remove dark mode toggle for v1 (single warm light theme only)
4. Add Google Fonts import for DM Sans + DM Serif Display

### `layout.tsx` changes

1. Remove Inter local font
2. Apply DM Sans as default body font via CSS variable

### Admin layout (`admin/layout.tsx`)

1. Rebuild sidebar with dark brown background, warm white nav links, burnt orange active state
2. Add Phosphor icons to nav items
3. Add collapsible behavior (icon-only at `lg:` breakpoint)

### Employee layout (`employee/layout.tsx`)

Same as admin sidebar pattern.

### Student layout (`student/layout.tsx`)

1. Update top bar (add notification bell slot)
2. Update bottom nav with Phosphor icons + burnt orange active state

### Shared

- Install `@phosphor-icons/react`
- Update all existing buttons, badges, inputs to new token values
- Update table styles in student + admin pages

---

## 11. Accessibility

- All text colors meet WCAG 4.5:1 on their backgrounds (verified above)
- Focus rings: `2px solid #C4622D` offset `2px`
- All interactive elements: `cursor-pointer`
- Phosphor icons paired with visible labels or `aria-label`
- `prefers-reduced-motion`: disable transitions when set
- Minimum touch target: 44×44px (bottom nav tabs, buttons)
