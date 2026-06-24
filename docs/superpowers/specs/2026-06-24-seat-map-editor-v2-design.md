# Seat Map Editor v2 — Design Spec

**Date:** 2026-06-24
**Scope:** Admin seat map editor redesign + student read-only map. Replaces the Phase 3C single-seat-circle editor.

---

## 1. Core Concepts

### Elements

| Element | Description | Bookable unit |
|---|---|---|
| **Table** | Rect on canvas, visual grouping only | No |
| **Chair (linked)** | Circle linked to a table via `table_id` | Yes — but reserving it blocks the whole table |
| **Chair (independent)** | Circle with no `table_id` | Yes — only that chair is blocked |

### Reservation logic
- When a linked chair is reserved → its parent table's `status` is set to `'occupied'` via DB trigger
- All other chairs linked to that table become visually blocked on the student map (unselectable)
- Independent chairs block only themselves
- Table status resets to `'free'` when all linked chairs return to `'free'`

---

## 2. Data Model Changes

### New table: `public.tables`

```sql
CREATE TABLE public.tables (
  id          uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  room_id     uuid        NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  label       text        NOT NULL DEFAULT '',
  position_x  numeric     NOT NULL DEFAULT 0,
  position_y  numeric     NOT NULL DEFAULT 0,
  width       numeric     NOT NULL DEFAULT 120,
  height      numeric     NOT NULL DEFAULT 80,
  rotation    integer     NOT NULL DEFAULT 0
                          CHECK (rotation >= 0 AND rotation < 360),
  status      text        NOT NULL DEFAULT 'free'
                          CHECK (status IN ('free', 'occupied', 'reserved')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

### Modify: `public.seats`

Add two columns:
```sql
ALTER TABLE public.seats
  ADD COLUMN table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL,
  ADD COLUMN rotation integer NOT NULL DEFAULT 0
             CHECK (rotation >= 0 AND rotation < 360);
```

### DB trigger: sync table status from chairs

When any seat's `status` changes:
- If `table_id IS NOT NULL`:
  - Any linked seat is `'occupied'` or `'reserved'` → set `tables.status = 'occupied'`
  - All linked seats are `'free'` → set `tables.status = 'free'`

---

## 3. Admin Editor UI

### Canvas
- Konva `Stage` 900×600px
- 40px dotted grid overlay (always visible)
- Snap-to-grid on by default (toggle in toolbar); elements snap on drag-end

### Toolbar (top bar)

| Action | Behavior |
|---|---|
| **Add table + chairs** | Picker: 1 / 2 / 4 / 6 seats (or custom N). Drops table rect with N chairs pre-positioned around its edges at equal angles. |
| **Add independent chair** | Drops a single chair circle with no `table_id` |
| **Snap toggle** | Toggles grid snap |
| **Delete** (`Delete` key also works) | Deletes selected elements; if table deleted, linked chairs become independent (not deleted) |

### Selection model
- Click table → selects table + all linked chairs (move as unit)
- Click individual chair → selects just that chair
- Shift+click → multi-select
- Drag on empty canvas → rectangle multi-select

### Rotation
- Konva `Transformer` on any selection provides rotation handle
- Rotation snaps to **15° increments**
- Rotating a table → all linked chairs rotate around the table center by the same delta
- Independent chairs rotate in place

### Align bar (appears when 2+ elements selected)
- Distribute evenly: horizontal / vertical
- Align: left / center-x / right / top / center-y / bottom
- Operates on bounding boxes of selected elements

### Properties panel (right sidebar, context-sensitive)

**Table selected:**
- Label (text input)
- Width / Height (number inputs, affects rect size)
- Rotation (read-only display, use transformer to change)
- "Add chair to this table" button
- List of linked chairs with remove buttons

**Chair selected:**
- Label (text input)
- Linked table (dropdown — link to a table or set independent)
- Out-of-service toggle
- Rotation (read-only, use transformer)

### Save behavior
- Single "Enregistrer" button persists all tables + seats in a batch server action
- New tables inserted first (to get IDs), then seats upserted with resolved `table_id`

---

## 4. Student Read-Only Map

Same Konva canvas, read-only. No toolbar, no transformer, no grid.

### Color scheme

| State | Table color | Chair color |
|---|---|---|
| Free / available | Gray outline | Blue fill |
| Table occupied (any chair taken) | Amber outline | Red fill (all chairs at this table) |
| Your current seat | — | Green fill |
| Out of service | — | Gray fill, 50% opacity |
| Independent chair — free | — | Blue fill |
| Independent chair — occupied | — | Red fill |

### Interaction
- Click free chair on free table → reservation confirm dialog → check-in
- Click any chair on occupied table → no action (tooltip: "Table occupée")
- Click free independent chair → reservation confirm dialog
- Click occupied independent chair → no action

---

## 5. Architecture

### New files

| Path | Purpose |
|---|---|
| `apps/database/supabase/migrations/YYYYMMDD_smp_tables.sql` | `tables` table + trigger |
| `apps/database/supabase/migrations/YYYYMMDD_smp_seats_v2.sql` | Add `table_id`, `rotation` to seats |
| `apps/web/src/data/admin/seat-map.ts` | Query tables + seats for a room together |
| `apps/web/src/utils/zod-schemas/table.ts` | Zod schemas for table upsert/delete |
| `apps/web/src/actions/admin/seat-map.ts` | `upsertSeatMapAction`, `deleteTableAction` |
| `apps/web/src/components/seat-map/TableToken.tsx` | Konva Rect + label for a table |
| `apps/web/src/components/seat-map/SeatToken.tsx` | Updated — accepts `rotation` |
| `apps/web/src/components/seat-map/AlignBar.tsx` | Align/distribute toolbar |
| `apps/web/src/components/seat-map/PropertiesPanel.tsx` | Right sidebar, context-sensitive |
| `apps/web/src/app/admin/rooms/[roomId]/editor/EditorCanvas.tsx` | Full rewrite |
| `apps/web/src/app/employee/rooms/[roomId]/map/page.tsx` | Student read-only map |

### State model (EditorCanvas)

```typescript
type TableData = {
  localId: string
  id: string | undefined
  room_id: string
  label: string
  position_x: number
  position_y: number
  width: number
  height: number
  rotation: number  // 0–345, multiples of 15
}

type SeatData = {
  localId: string
  id: string | undefined
  room_id: string
  table_local_id: string | undefined  // links to TableData.localId
  table_id: string | undefined        // DB id, resolved on save
  label: string
  position_x: number
  position_y: number
  rotation: number
  status: 'free' | 'occupied' | 'reserved' | 'out_of_service'
}
```

### Key interactions

**Drag table:** compute dx/dy delta → apply to table position AND all seats where `table_local_id === table.localId`

**Rotate table:** compute delta degrees (snapped to 15°) → rotate table → rotate each linked seat's position around table center by same delta

**Add table + N chairs:** generate 1 `TableData` + N `SeatData` with positions distributed around table rect edges

**Distribute evenly:** compute bounding boxes of selected elements → redistribute positions with equal gaps

---

## 6. Out of Scope

- Group/friend booking (students coordinate outside the app)
- Custom table shapes (round, L-shaped)
- Free-form rotation (15° snap only)
- Undo/redo
- Zoom/pan on editor canvas
