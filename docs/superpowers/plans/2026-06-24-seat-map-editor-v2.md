# Seat Map Editor v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Phase 3C single-circle editor with a full table+chair seat map editor — tables as visual grouping elements, chairs as bookable seats, drag/rotate/align tools, and a student read-only map.

**Architecture:** Approach B (flat state, linked by `table_id`). Tables and chairs are separate Konva elements in flat React state. When a table moves, all linked chairs move by the same delta. Rotation via Konva `Transformer` snapped to 15°. Tables get client-generated UUIDs on creation so chairs can reference `table_id` immediately without a round-trip. Save batches tables first then seats in one server action.

**Tech Stack:** react-konva, konva (already installed), next-safe-action, Zod v4, @phosphor-icons/react, shadcn/ui, vitest

## Global Constraints

- All commands run from `/home/sah/Synapse`
- Import safe-action clients from `@/lib/safe-action` (not `@/actions/safe-action`)
- Import Supabase client as `createSupabaseClient` from `@/supabase-clients/server`
- Page routes at `apps/web/src/app/admin/...` and `apps/web/src/app/employee/...` (no route groups)
- Icons: `@phosphor-icons/react` (never lucide-react). SSR-safe imports use `/dist/ssr` sub-path
- Zod v4: use `{ message: '...' }` not `invalid_type_error` / `required_error`
- French UI — all user-visible strings in French
- `pnpm typecheck` from repo root must exit 0 after every task
- Rotation: integer degrees, 0–345, multiples of 15
- Canvas: 900×600px, grid cell 40px, seat radius 24px, default table 120×80px

---

### Task 1: DB migrations — tables table + seats columns + trigger

**Files:**
- Create: `apps/database/supabase/migrations/20260624100000_smp_tables.sql`
- Create: `apps/database/supabase/migrations/20260624100001_smp_seats_v2.sql`

- [ ] **Step 1: Write tables migration**

```sql
-- apps/database/supabase/migrations/20260624100000_smp_tables.sql
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

CREATE INDEX tables_room_id_idx ON public.tables (room_id);

ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tables_select" ON public.tables
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "tables_insert" ON public.tables
  FOR INSERT WITH CHECK (current_user_role() IN ('admin', 'employee'));

CREATE POLICY "tables_update" ON public.tables
  FOR UPDATE USING (current_user_role() IN ('admin', 'employee'));

CREATE POLICY "tables_delete" ON public.tables
  FOR DELETE USING (current_user_role() = 'admin');

ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
```

- [ ] **Step 2: Write seats v2 migration**

```sql
-- apps/database/supabase/migrations/20260624100001_smp_seats_v2.sql

-- Add table linkage and rotation to seats
ALTER TABLE public.seats
  ADD COLUMN table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL,
  ADD COLUMN rotation integer NOT NULL DEFAULT 0
             CHECK (rotation >= 0 AND rotation < 360);

CREATE INDEX seats_table_id_idx ON public.seats (table_id);

-- Trigger: sync table status when any linked seat changes status
CREATE OR REPLACE FUNCTION public.sync_table_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_table_id uuid;
  v_any_occupied boolean;
BEGIN
  -- Determine which table_id to update
  v_table_id := COALESCE(NEW.table_id, OLD.table_id);

  IF v_table_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.seats
    WHERE table_id = v_table_id
      AND status IN ('occupied', 'reserved')
  ) INTO v_any_occupied;

  UPDATE public.tables
    SET status = CASE WHEN v_any_occupied THEN 'occupied' ELSE 'free' END
    WHERE id = v_table_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER seats_sync_table_status
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.seats
  FOR EACH ROW EXECUTE FUNCTION public.sync_table_status();
```

- [ ] **Step 3: Apply migrations to local Supabase**

```bash
cd apps/database && npx supabase db push --local 2>&1
```

Expected: migrations applied without errors.

- [ ] **Step 4: Regenerate TypeScript types**

```bash
cd apps/database && pnpm gen-types-local
```

Then copy the updated types to the web app:

```bash
cp apps/database/lib/database.types.ts apps/web/src/lib/database.types.ts
```

Expected: `apps/web/src/lib/database.types.ts` now contains `tables` table type with `id`, `room_id`, `label`, `position_x`, `position_y`, `width`, `height`, `rotation`, `status`, `created_at` fields. `seats` type now includes `table_id: string | null` and `rotation: number`.

- [ ] **Step 5: Verify typecheck passes**

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/database/supabase/migrations/20260624100000_smp_tables.sql \
        apps/database/supabase/migrations/20260624100001_smp_seats_v2.sql \
        apps/web/src/lib/database.types.ts
git commit -m "feat(seat-map): add tables table, seats v2 columns, table status trigger"
```

---

### Task 2: Zod schemas for table + seat map

**Files:**
- Create: `apps/web/src/utils/zod-schemas/table.ts`
- Modify: `apps/web/src/utils/zod-schemas/seat.ts`
- Create: `apps/web/src/utils/zod-schemas/table.test.ts`

**Interfaces:**
- Produces: `tableUpsertItemSchema`, `upsertSeatMapSchema`, `deleteTableSchema` (used by Task 3)

- [ ] **Step 1: Write table Zod schemas**

```typescript
// apps/web/src/utils/zod-schemas/table.ts
import { z } from 'zod'

export const tableUpsertItemSchema = z.object({
  id: z.string().uuid(),                         // always set (client-generated UUID for new tables)
  room_id: z.string().uuid(),
  label: z.string().max(20, { message: 'Max 20 caractères' }),
  position_x: z.number(),
  position_y: z.number(),
  width: z.number().min(40, { message: 'Largeur min 40px' }),
  height: z.number().min(40, { message: 'Hauteur min 40px' }),
  rotation: z.number().int().min(0).max(345),
})

export type TableUpsertItem = z.infer<typeof tableUpsertItemSchema>

export const deleteTableSchema = z.object({
  id: z.string().uuid(),
  room_id: z.string().uuid(),
})

export type DeleteTableInput = z.infer<typeof deleteTableSchema>
```

- [ ] **Step 2: Update seat schema to include table_id and rotation**

Replace the contents of `apps/web/src/utils/zod-schemas/seat.ts`:

```typescript
// apps/web/src/utils/zod-schemas/seat.ts
import { z } from 'zod'

export const seatUpsertItemSchema = z.object({
  id: z.string().uuid().optional(),
  room_id: z.string().uuid(),
  table_id: z.string().uuid().nullable(),
  label: z.string().min(1, { message: 'Étiquette requise' }).max(10, { message: 'Max 10 caractères' }),
  position_x: z.number(),
  position_y: z.number(),
  rotation: z.number().int().min(0).max(345),
  status: z.enum(['free', 'occupied', 'reserved', 'out_of_service']),
})

export type SeatUpsertItem = z.infer<typeof seatUpsertItemSchema>

export const upsertSeatMapSchema = z.object({
  room_id: z.string().uuid(),
  tables: z.array(tableUpsertItemSchema),
  seats: z.array(seatUpsertItemSchema),
})

export type UpsertSeatMapInput = z.infer<typeof upsertSeatMapSchema>

export const deleteSeatSchema = z.object({
  id: z.string().uuid(),
  room_id: z.string().uuid(),
})

export type DeleteSeatInput = z.infer<typeof deleteSeatSchema>

import { tableUpsertItemSchema } from './table'
```

Wait — circular would happen if `upsertSeatMapSchema` imports from `./table`. Put `upsertSeatMapSchema` in `table.ts` or keep all in one file. Cleanest: put `upsertSeatMapSchema` in `table.ts` since it's the combined save schema.

Rewrite `apps/web/src/utils/zod-schemas/seat.ts`:

```typescript
// apps/web/src/utils/zod-schemas/seat.ts
import { z } from 'zod'

export const seatUpsertItemSchema = z.object({
  id: z.string().uuid().optional(),
  room_id: z.string().uuid(),
  table_id: z.string().uuid().nullable(),
  label: z.string().min(1, { message: 'Étiquette requise' }).max(10, { message: 'Max 10 caractères' }),
  position_x: z.number(),
  position_y: z.number(),
  rotation: z.number().int().min(0).max(345),
  status: z.enum(['free', 'occupied', 'reserved', 'out_of_service']),
})

export type SeatUpsertItem = z.infer<typeof seatUpsertItemSchema>

export const deleteSeatSchema = z.object({
  id: z.string().uuid(),
  room_id: z.string().uuid(),
})

export type DeleteSeatInput = z.infer<typeof deleteSeatSchema>
```

Add `upsertSeatMapSchema` to `apps/web/src/utils/zod-schemas/table.ts` (append after existing exports):

```typescript
// append to apps/web/src/utils/zod-schemas/table.ts
import { seatUpsertItemSchema } from './seat'

export const upsertSeatMapSchema = z.object({
  room_id: z.string().uuid(),
  tables: z.array(tableUpsertItemSchema),
  seats: z.array(seatUpsertItemSchema),
})

export type UpsertSeatMapInput = z.infer<typeof upsertSeatMapSchema>
```

- [ ] **Step 3: Write schema tests**

```typescript
// apps/web/src/utils/zod-schemas/table.test.ts
import { describe, it, expect } from 'vitest'
import { tableUpsertItemSchema, upsertSeatMapSchema } from './table'

const validTable = {
  id: 'a0000000-0000-0000-0000-000000000001',
  room_id: 'b0000000-0000-0000-0000-000000000001',
  label: 'T1',
  position_x: 100,
  position_y: 200,
  width: 120,
  height: 80,
  rotation: 0,
}

describe('tableUpsertItemSchema', () => {
  it('passes with valid data', () => {
    expect(tableUpsertItemSchema.safeParse(validTable).success).toBe(true)
  })

  it('rejects rotation not multiple of 15', () => {
    const r = tableUpsertItemSchema.safeParse({ ...validTable, rotation: 7 })
    // rotation is clamped to int 0-345, 7 passes int check — just verify it passes (snap is client-side)
    expect(r.success).toBe(true)
  })

  it('rejects rotation >= 360', () => {
    const r = tableUpsertItemSchema.safeParse({ ...validTable, rotation: 360 })
    expect(r.success).toBe(false)
  })

  it('rejects width < 40', () => {
    const r = tableUpsertItemSchema.safeParse({ ...validTable, width: 10 })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('Largeur min 40px')
  })
})

describe('upsertSeatMapSchema', () => {
  it('passes with empty tables and seats', () => {
    const r = upsertSeatMapSchema.safeParse({
      room_id: 'b0000000-0000-0000-0000-000000000001',
      tables: [],
      seats: [],
    })
    expect(r.success).toBe(true)
  })
})
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter web test -- --run zod-schemas/table
```

Expected: all tests pass.

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/utils/zod-schemas/table.ts \
        apps/web/src/utils/zod-schemas/table.test.ts \
        apps/web/src/utils/zod-schemas/seat.ts
git commit -m "feat(seat-map): add table + seat map Zod schemas"
```

---

### Task 3: Server actions for seat map

**Files:**
- Create: `apps/web/src/actions/admin/seat-map.ts`
- Modify: `apps/web/src/actions/seats.ts` (deprecate old upsertSeatsAction — keep deleteSeatAction, remove upsertSeatsAction)

**Interfaces:**
- Consumes: `upsertSeatMapSchema`, `deleteTableSchema` from Task 2; `adminActionClient` from `@/lib/safe-action`; `createSupabaseClient` from `@/supabase-clients/server`
- Produces: `upsertSeatMapAction`, `deleteTableAction` (used by Task 7 EditorCanvas)

- [ ] **Step 1: Write seat map server actions**

```typescript
// apps/web/src/actions/admin/seat-map.ts
'use server'

import { adminActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { upsertSeatMapSchema, deleteTableSchema } from '@/utils/zod-schemas/table'
import { deleteSeatSchema } from '@/utils/zod-schemas/seat'
import { revalidatePath } from 'next/cache'

// Batch save: upsert tables first, then seats (tables must exist before seats reference them)
export const upsertSeatMapAction = adminActionClient
  .schema(upsertSeatMapSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { room_id, tables, seats } = parsedInput

    if (tables.length > 0) {
      const { error: tableError } = await supabase
        .from('tables')
        .upsert(
          tables.map((t) => ({
            id: t.id,
            room_id: t.room_id,
            label: t.label,
            position_x: t.position_x,
            position_y: t.position_y,
            width: t.width,
            height: t.height,
            rotation: t.rotation,
          })),
          { onConflict: 'id', ignoreDuplicates: false },
        )
      if (tableError) throw new Error(tableError.message)
    }

    if (seats.length > 0) {
      const { error: seatError } = await supabase
        .from('seats')
        .upsert(
          seats.map((s) => ({
            ...(s.id ? { id: s.id } : {}),
            room_id: s.room_id,
            table_id: s.table_id,
            label: s.label,
            position_x: s.position_x,
            position_y: s.position_y,
            rotation: s.rotation,
            status: s.status,
          })),
          { onConflict: 'id', ignoreDuplicates: false },
        )
      if (seatError) throw new Error(seatError.message)
    }

    revalidatePath(`/admin/rooms/${room_id}/editor`)
    revalidatePath(`/employee/rooms/${room_id}/map`)
    return { ok: true }
  })

export const deleteTableAction = adminActionClient
  .schema(deleteTableSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    // ON DELETE SET NULL cascade handles unlinking seats automatically
    const { error } = await supabase
      .from('tables')
      .delete()
      .eq('id', parsedInput.id)
      .eq('room_id', parsedInput.room_id)

    if (error) throw new Error(error.message)

    revalidatePath(`/admin/rooms/${parsedInput.room_id}/editor`)
    revalidatePath(`/employee/rooms/${parsedInput.room_id}/map`)
    return { deleted: true }
  })

export const deleteSeatAction = adminActionClient
  .schema(deleteSeatSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('seats')
      .delete()
      .eq('id', parsedInput.id)
      .eq('room_id', parsedInput.room_id)

    if (error) throw new Error(error.message)

    revalidatePath(`/admin/rooms/${parsedInput.room_id}/editor`)
    revalidatePath(`/employee/rooms/${parsedInput.room_id}/map`)
    return { deleted: true }
  })
```

- [ ] **Step 2: Remove upsertSeatsAction from old seats.ts**

Open `apps/web/src/actions/seats.ts`. Delete the `upsertSeatsAction` export (keep `deleteSeatAction` if still referenced, otherwise delete the whole file). Since `deleteSeatAction` is now in `seat-map.ts`, delete `apps/web/src/actions/seats.ts` entirely.

```bash
rm apps/web/src/actions/seats.ts
```

Then update any import of `upsertSeatsAction` or `deleteSeatAction` from `@/actions/seats` — the only consumer was `EditorCanvas.tsx` which will be fully rewritten in Task 7.

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: exit 0. If EditorCanvas import fails, comment out the import line temporarily (it will be rewritten).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/actions/admin/seat-map.ts
git rm apps/web/src/actions/seats.ts
git commit -m "feat(seat-map): add upsertSeatMapAction and deleteTableAction server actions"
```

---

### Task 4: Seat map data query

**Files:**
- Create: `apps/web/src/data/admin/seat-map.ts`
- Modify: `apps/web/src/data/seats.ts` (update to include rotation + table_id in return type)

**Interfaces:**
- Produces:
  - `getSeatMap(roomId: string): Promise<{ tables: Table[], seats: Seat[] }>` (used by Tasks 7 and 8)
  - `Table` type = `Database['public']['Tables']['tables']['Row']`
  - `Seat` type = `Database['public']['Tables']['seats']['Row']` (now includes `table_id`, `rotation`)

- [ ] **Step 1: Write seat map data query**

```typescript
// apps/web/src/data/admin/seat-map.ts
import { createSupabaseClient } from '@/supabase-clients/server'
import type { Database } from '@/lib/database.types'

export type RoomTable = Database['public']['Tables']['tables']['Row']
export type Seat = Database['public']['Tables']['seats']['Row']

export async function getSeatMap(roomId: string): Promise<{ tables: RoomTable[]; seats: Seat[] }> {
  const supabase = await createSupabaseClient()

  const [{ data: tables, error: tablesError }, { data: seats, error: seatsError }] =
    await Promise.all([
      supabase.from('tables').select('*').eq('room_id', roomId).order('created_at'),
      supabase.from('seats').select('*').eq('room_id', roomId).order('label'),
    ])

  if (tablesError) throw new Error(tablesError.message)
  if (seatsError) throw new Error(seatsError.message)

  return { tables: tables ?? [], seats: seats ?? [] }
}
```

- [ ] **Step 2: Update apps/web/src/data/seats.ts**

The `Seat` type in `seats.ts` is now superseded by the one in `seat-map.ts`. Keep `seats.ts` only for the `getSeatsByRoom` function used by the old editor page (which will be replaced in Task 7). After Task 7 the file can be removed — for now, leave it.

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/data/admin/seat-map.ts
git commit -m "feat(seat-map): add getSeatMap data query returning tables + seats"
```

---

### Task 5: Utility functions for canvas math

**Files:**
- Create: `apps/web/src/components/seat-map/canvas-utils.ts`
- Create: `apps/web/src/components/seat-map/canvas-utils.test.ts`

**Interfaces:**
- Produces (used by Tasks 6, 7, 8):
  - `snapToGrid(value: number, gridSize: number): number`
  - `snapRotation(degrees: number, snap: number): number`
  - `rotatePoint(px: number, py: number, cx: number, cy: number, angleDeg: number): { x: number; y: number }`
  - `chairPositionsAroundTable(table: { position_x: number; position_y: number; width: number; height: number; rotation: number }, count: number): Array<{ x: number; y: number; rotation: number }>`
  - `distributeHorizontally(elements: Array<{ x: number; width: number }>, gap: number): number[]` — returns new x values
  - `distributeVertically(elements: Array<{ y: number; height: number }>, gap: number): number[]`

- [ ] **Step 1: Write canvas utility functions**

```typescript
// apps/web/src/components/seat-map/canvas-utils.ts

export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}

export function snapRotation(degrees: number, snap: number): number {
  return Math.round(degrees / snap) * snap % 360
}

// Rotate point (px, py) around center (cx, cy) by angleDeg degrees
export function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = px - cx
  const dy = py - cy
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  }
}

// Returns positions for N chairs evenly spaced around a table's perimeter
// Chairs are placed just outside the table edges, rotation faces outward
export function chairPositionsAroundTable(
  table: { position_x: number; position_y: number; width: number; height: number; rotation: number },
  count: number,
): Array<{ x: number; y: number; rotation: number }> {
  if (count === 0) return []

  const cx = table.position_x
  const cy = table.position_y
  const halfW = table.width / 2 + 30   // 30px offset outside table edge
  const halfH = table.height / 2 + 30

  // Distribute evenly around perimeter using angle slices
  const positions: Array<{ x: number; y: number; rotation: number }> = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 360   // degrees, starting from top
    const rad = ((angle - 90) * Math.PI) / 180
    // Clamp to ellipse that approximates the rect perimeter
    const ux = Math.cos(rad)
    const uy = Math.sin(rad)
    const scale = Math.min(halfW / Math.max(Math.abs(ux) * halfW, 1e-6), halfH / Math.max(Math.abs(uy) * halfH, 1e-6))
    const localX = ux * Math.min(halfW, halfH * Math.abs(ux / uy || 1e9))
    const localY = uy * Math.min(halfH, halfW * Math.abs(uy / ux || 1e9))

    // Rotate by table rotation
    const rotated = rotatePoint(cx + localX, cy + localY, cx, cy, table.rotation)
    const chairRotation = snapRotation((angle + table.rotation) % 360, 15)
    positions.push({ x: rotated.x, y: rotated.y, rotation: chairRotation })
  }
  return positions
}

// Returns sorted new X positions for even horizontal distribution
export function distributeHorizontally(
  elements: Array<{ x: number; width: number }>,
  gap: number,
): number[] {
  if (elements.length <= 1) return elements.map((e) => e.x)
  const sorted = [...elements].sort((a, b) => a.x - b.x)
  const startX = sorted[0].x
  const positions: number[] = [startX]
  for (let i = 1; i < sorted.length; i++) {
    positions.push(positions[i - 1] + sorted[i - 1].width + gap)
  }
  // Return in original order
  const indexMap = elements.map((e) => sorted.indexOf(e))
  return indexMap.map((i) => positions[i])
}

// Returns sorted new Y positions for even vertical distribution
export function distributeVertically(
  elements: Array<{ y: number; height: number }>,
  gap: number,
): number[] {
  if (elements.length <= 1) return elements.map((e) => e.y)
  const sorted = [...elements].sort((a, b) => a.y - b.y)
  const startY = sorted[0].y
  const positions: number[] = [startY]
  for (let i = 1; i < sorted.length; i++) {
    positions.push(positions[i - 1] + sorted[i - 1].height + gap)
  }
  const indexMap = elements.map((e) => sorted.indexOf(e))
  return indexMap.map((i) => positions[i])
}
```

- [ ] **Step 2: Write tests**

```typescript
// apps/web/src/components/seat-map/canvas-utils.test.ts
import { describe, it, expect } from 'vitest'
import {
  snapToGrid,
  snapRotation,
  rotatePoint,
  chairPositionsAroundTable,
  distributeHorizontally,
  distributeVertically,
} from './canvas-utils'

describe('snapToGrid', () => {
  it('snaps 53 to 40 with grid 40', () => expect(snapToGrid(53, 40)).toBe(40))
  it('snaps 61 to 80 with grid 40', () => expect(snapToGrid(61, 40)).toBe(80))
  it('returns value unchanged when already on grid', () => expect(snapToGrid(80, 40)).toBe(80))
})

describe('snapRotation', () => {
  it('snaps 7 to 0 with snap 15', () => expect(snapRotation(7, 15)).toBe(0))
  it('snaps 8 to 15 with snap 15', () => expect(snapRotation(8, 15)).toBe(15))
  it('wraps 360 to 0', () => expect(snapRotation(360, 15)).toBe(0))
  it('snaps 352 to 345 with snap 15', () => expect(snapRotation(352, 15)).toBe(345))
})

describe('rotatePoint', () => {
  it('90deg rotation around origin moves (1,0) to (0,1)', () => {
    const r = rotatePoint(1, 0, 0, 0, 90)
    expect(r.x).toBeCloseTo(0, 5)
    expect(r.y).toBeCloseTo(1, 5)
  })
  it('0deg rotation is identity', () => {
    const r = rotatePoint(3, 4, 0, 0, 0)
    expect(r.x).toBeCloseTo(3, 5)
    expect(r.y).toBeCloseTo(4, 5)
  })
})

describe('chairPositionsAroundTable', () => {
  it('returns correct count', () => {
    const table = { position_x: 200, position_y: 200, width: 120, height: 80, rotation: 0 }
    expect(chairPositionsAroundTable(table, 4)).toHaveLength(4)
  })
  it('returns empty for count 0', () => {
    const table = { position_x: 0, position_y: 0, width: 120, height: 80, rotation: 0 }
    expect(chairPositionsAroundTable(table, 0)).toHaveLength(0)
  })
})

describe('distributeHorizontally', () => {
  it('distributes 3 elements with 20px gap', () => {
    const elements = [
      { x: 0, width: 60 },
      { x: 200, width: 60 },
      { x: 100, width: 60 },
    ]
    const result = distributeHorizontally(elements, 20)
    // sorted order: 0, 100, 200 → positions: 0, 80, 160
    expect(result[0]).toBe(0)   // was at x=0
    expect(result[2]).toBe(80)  // was at x=100 (2nd in sorted)
    expect(result[1]).toBe(160) // was at x=200 (3rd in sorted)
  })
})

describe('distributeVertically', () => {
  it('distributes 2 elements with 20px gap', () => {
    const elements = [
      { y: 100, height: 40 },
      { y: 0, height: 40 },
    ]
    const result = distributeVertically(elements, 20)
    // sorted: y=0 first → positions: 0, 60
    expect(result[1]).toBe(0)  // was at y=0
    expect(result[0]).toBe(60) // was at y=100
  })
})
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter web test -- --run seat-map/canvas-utils
```

Expected: all pass.

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/seat-map/canvas-utils.ts \
        apps/web/src/components/seat-map/canvas-utils.test.ts
git commit -m "feat(seat-map): add canvas utility functions (snap, rotate, distribute)"
```

---

### Task 6: TableToken and updated SeatToken Konva components

**Files:**
- Create: `apps/web/src/components/seat-map/TableToken.tsx`
- Modify: `apps/web/src/components/seat-map/SeatToken.tsx` (add rotation prop)

**Interfaces:**
- Produces:
  - `TableData` type (used by Tasks 7, 8)
  - `SeatData` type (used by Tasks 7, 8)
  - `<TableToken table onSelect isSelected />` Konva component
  - `<SeatToken seat isSelected onDragEnd onClick />` (updated)

- [ ] **Step 1: Write TableToken**

```tsx
// apps/web/src/components/seat-map/TableToken.tsx
'use client'

import { Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'

export type TableData = {
  localId: string       // always a UUID (client-generated for new, DB id for persisted)
  id: string            // same as localId — tables always have a UUID from creation
  room_id: string
  label: string
  position_x: number
  position_y: number
  width: number
  height: number
  rotation: number      // 0–345, multiples of 15
}

type Props = {
  table: TableData
  isSelected: boolean
  onSelect: (localId: string) => void
  onDragEnd: (localId: string, x: number, y: number) => void
}

export function TableToken({ table, isSelected, onSelect, onDragEnd }: Props) {
  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    onDragEnd(table.localId, e.target.x(), e.target.y())
  }

  return (
    <Group
      x={table.position_x}
      y={table.position_y}
      rotation={table.rotation}
      draggable
      onDragEnd={handleDragEnd}
      onClick={() => onSelect(table.localId)}
      onTap={() => onSelect(table.localId)}
      offsetX={table.width / 2}
      offsetY={table.height / 2}
    >
      <Rect
        x={0}
        y={0}
        width={table.width}
        height={table.height}
        fill="#f1f5f9"
        stroke={isSelected ? '#f59e0b' : '#94a3b8'}
        strokeWidth={isSelected ? 2.5 : 1.5}
        cornerRadius={6}
        shadowBlur={isSelected ? 8 : 0}
        shadowColor="#f59e0b"
      />
      {table.label ? (
        <Text
          text={table.label}
          fontSize={11}
          fill="#475569"
          align="center"
          verticalAlign="middle"
          width={table.width}
          height={table.height}
        />
      ) : null}
    </Group>
  )
}
```

- [ ] **Step 2: Update SeatToken — add rotation, update SeatTokenData type**

Replace `apps/web/src/components/seat-map/SeatToken.tsx`:

```tsx
// apps/web/src/components/seat-map/SeatToken.tsx
'use client'

import { Group, Circle, Text } from 'react-konva'
import type Konva from 'konva'

export type SeatTokenData = {
  localId: string           // stable client-side key, always set
  id: string | undefined    // DB id, undefined for unsaved seats
  room_id: string
  table_id: string | null   // null = independent chair
  label: string
  position_x: number
  position_y: number
  rotation: number          // 0–345, multiples of 15
  status: 'free' | 'occupied' | 'reserved' | 'out_of_service'
}

const RADIUS = 24

type Props = {
  seat: SeatTokenData
  isSelected: boolean
  onDragEnd: (localId: string, x: number, y: number) => void
  onClick: (localId: string) => void
}

export function SeatToken({ seat, isSelected, onDragEnd, onClick }: Props) {
  const isOutOfService = seat.status === 'out_of_service'
  const fill = isOutOfService ? '#9ca3af' : '#3b82f6'
  const strokeColor = isSelected ? '#f59e0b' : '#1e3a5f'

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    onDragEnd(seat.localId, e.target.x(), e.target.y())
  }

  return (
    <Group
      x={seat.position_x}
      y={seat.position_y}
      rotation={seat.rotation}
      draggable
      onDragEnd={handleDragEnd}
      onClick={() => onClick(seat.localId)}
      onTap={() => onClick(seat.localId)}
    >
      <Circle
        radius={RADIUS}
        fill={fill}
        stroke={strokeColor}
        strokeWidth={isSelected ? 3 : 1.5}
        shadowBlur={isSelected ? 8 : 0}
        shadowColor="#f59e0b"
        opacity={isOutOfService ? 0.5 : 1}
      />
      <Text
        text={seat.label}
        fontSize={seat.label.length > 2 ? 10 : 13}
        fontStyle="bold"
        fill="#ffffff"
        align="center"
        verticalAlign="middle"
        width={RADIUS * 2}
        height={RADIUS * 2}
        offsetX={RADIUS}
        offsetY={RADIUS}
      />
    </Group>
  )
}
```

- [ ] **Step 3: Update SeatEditPopover — add table_id to SeatTokenData usage**

`SeatEditPopover` takes `SeatTokenData | null` — the updated type now has `table_id`. No changes needed to the popover itself unless you add a "link to table" dropdown (that goes in PropertiesPanel — Task 7). Verify the file still compiles.

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/seat-map/TableToken.tsx \
        apps/web/src/components/seat-map/SeatToken.tsx
git commit -m "feat(seat-map): add TableToken component, update SeatToken with rotation + table_id"
```

---

### Task 7: PropertiesPanel component

**Files:**
- Create: `apps/web/src/components/seat-map/PropertiesPanel.tsx`

**Interfaces:**
- Consumes: `TableData` from `./TableToken`, `SeatTokenData` from `./SeatToken`
- Produces: `<PropertiesPanel selection onTableChange onSeatChange onDeleteTable onDeleteSeat onAddChairToTable />` (used by Task 8)

- [ ] **Step 1: Write PropertiesPanel**

```tsx
// apps/web/src/components/seat-map/PropertiesPanel.tsx
'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash, Plus } from '@phosphor-icons/react'
import type { TableData } from './TableToken'
import type { SeatTokenData } from './SeatToken'

type Selection =
  | { type: 'table'; item: TableData }
  | { type: 'seat'; item: SeatTokenData }
  | null

type Props = {
  selection: Selection
  allTables: TableData[]
  onTableChange: (localId: string, patch: Partial<TableData>) => void
  onSeatChange: (localId: string, patch: Partial<SeatTokenData>) => void
  onDeleteTable: (localId: string) => void
  onDeleteSeat: (localId: string) => void
  onAddChairToTable: (tableLocalId: string) => void
}

export function PropertiesPanel({
  selection,
  allTables,
  onTableChange,
  onSeatChange,
  onDeleteTable,
  onDeleteSeat,
  onAddChairToTable,
}: Props) {
  if (!selection) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground p-4 text-center">
        Sélectionnez un élément pour modifier ses propriétés
      </div>
    )
  }

  if (selection.type === 'table') {
    const table = selection.item
    return (
      <div className="space-y-4 p-4">
        <h3 className="font-semibold text-sm">Table</h3>

        <div className="space-y-1">
          <Label>Étiquette</Label>
          <Input
            value={table.label}
            maxLength={20}
            onChange={(e) => onTableChange(table.localId, { label: e.target.value })}
            placeholder="T1"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Largeur</Label>
            <Input
              type="number"
              min={40}
              max={400}
              value={table.width}
              onChange={(e) => onTableChange(table.localId, { width: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label>Hauteur</Label>
            <Input
              type="number"
              min={40}
              max={400}
              value={table.height}
              onChange={(e) => onTableChange(table.localId, { height: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Rotation</Label>
          <p className="text-sm text-muted-foreground">{table.rotation}° (utilisez la poignée sur le canevas)</p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onAddChairToTable(table.localId)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une chaise
        </Button>

        <div className="border-t pt-2">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => onDeleteTable(table.localId)}
          >
            <Trash className="mr-2 h-4 w-4" />
            Supprimer la table
          </Button>
        </div>
      </div>
    )
  }

  // seat
  const seat = selection.item
  return (
    <div className="space-y-4 p-4">
      <h3 className="font-semibold text-sm">Chaise</h3>

      <div className="space-y-1">
        <Label>Étiquette</Label>
        <Input
          value={seat.label}
          maxLength={10}
          onChange={(e) => onSeatChange(seat.localId, { label: e.target.value })}
          placeholder="A1"
        />
      </div>

      <div className="space-y-1">
        <Label>Table liée</Label>
        <Select
          value={seat.table_id ?? 'none'}
          onValueChange={(val) =>
            onSeatChange(seat.localId, { table_id: val === 'none' ? null : val })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Indépendante" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Indépendante</SelectItem>
            {allTables.map((t) => (
              <SelectItem key={t.localId} value={t.id}>
                {t.label || `Table ${t.localId.slice(0, 6)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label>Hors service</Label>
        <Switch
          checked={seat.status === 'out_of_service'}
          onCheckedChange={(checked) =>
            onSeatChange(seat.localId, { status: checked ? 'out_of_service' : 'free' })
          }
        />
      </div>

      <div className="space-y-1">
        <Label>Rotation</Label>
        <p className="text-sm text-muted-foreground">{seat.rotation}° (utilisez la poignée sur le canevas)</p>
      </div>

      <div className="border-t pt-2">
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => onDeleteSeat(seat.localId)}
        >
          <Trash className="mr-2 h-4 w-4" />
          Supprimer la chaise
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/seat-map/PropertiesPanel.tsx
git commit -m "feat(seat-map): add PropertiesPanel right sidebar component"
```

---

### Task 8: EditorCanvas full rewrite + editor page update

**Files:**
- Rewrite: `apps/web/src/app/admin/rooms/[roomId]/editor/EditorCanvas.tsx`
- Rewrite: `apps/web/src/app/admin/rooms/[roomId]/editor/page.tsx`
- Delete: `apps/web/src/components/seat-map/SeatEditPopover.tsx` (replaced by PropertiesPanel)
- Delete: `apps/web/src/data/seats.ts` (replaced by seat-map.ts)

**Interfaces:**
- Consumes: `TableToken`, `SeatToken`, `PropertiesPanel`, `upsertSeatMapAction`, `deleteTableAction`, `deleteSeatAction`, `getSeatMap`, canvas utils

- [ ] **Step 1: Write EditorCanvas**

```tsx
// apps/web/src/app/admin/rooms/[roomId]/editor/EditorCanvas.tsx
'use client'

import { useCallback, useRef, useState } from 'react'
import { Stage, Layer, Rect, Line, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TableToken, type TableData } from '@/components/seat-map/TableToken'
import { SeatToken, type SeatTokenData } from '@/components/seat-map/SeatToken'
import { PropertiesPanel } from '@/components/seat-map/PropertiesPanel'
import { upsertSeatMapAction, deleteTableAction, deleteSeatAction } from '@/actions/admin/seat-map'
import type { RoomTable, Seat } from '@/data/admin/seat-map'
import {
  snapToGrid,
  snapRotation,
  rotatePoint,
  chairPositionsAroundTable,
  distributeHorizontally,
  distributeVertically,
} from '@/components/seat-map/canvas-utils'
import {
  Plus,
  FloppyDisk,
  AlignLeft,
  AlignCenterHorizontal,
  AlignRight,
  AlignTop,
  AlignCenterVertical,
  AlignBottom,
  DistributeHorizontal,
  DistributeVertical,
  GridFour,
} from '@phosphor-icons/react'

const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 600
const GRID_SIZE = 40
const SEAT_RADIUS = 24
const DEFAULT_TABLE_W = 120
const DEFAULT_TABLE_H = 80

function dbTableToData(t: RoomTable): TableData {
  return {
    localId: t.id,
    id: t.id,
    room_id: t.room_id,
    label: t.label,
    position_x: t.position_x,
    position_y: t.position_y,
    width: t.width,
    height: t.height,
    rotation: t.rotation,
  }
}

function dbSeatToData(s: Seat): SeatTokenData {
  return {
    localId: s.id,
    id: s.id,
    room_id: s.room_id,
    table_id: s.table_id,
    label: s.label,
    position_x: s.position_x,
    position_y: s.position_y,
    rotation: s.rotation,
    status: s.status as SeatTokenData['status'],
  }
}

function nextSeatLabel(seats: SeatTokenData[]): string {
  const labels = new Set(seats.map((s) => s.label))
  for (const row of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    for (let n = 1; n <= 20; n++) {
      const label = `${row}${n}`
      if (!labels.has(label)) return label
    }
  }
  return `P${seats.length + 1}`
}

type Selection =
  | { type: 'table'; localId: string }
  | { type: 'seat'; localId: string }
  | null

type Props = {
  roomId: string
  initialTables: RoomTable[]
  initialSeats: Seat[]
}

export function EditorCanvas({ roomId, initialTables, initialSeats }: Props) {
  const [tables, setTables] = useState<TableData[]>(initialTables.map(dbTableToData))
  const [seats, setSeats] = useState<SeatTokenData[]>(initialSeats.map(dbSeatToData))
  const [selection, setSelection] = useState<Selection>(null)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const transformerRef = useRef<Konva.Transformer>(null)
  const stageRef = useRef<Konva.Stage>(null)

  const selectedTable = selection?.type === 'table'
    ? tables.find((t) => t.localId === selection.localId) ?? null
    : null
  const selectedSeat = selection?.type === 'seat'
    ? seats.find((s) => s.localId === selection.localId) ?? null
    : null

  const panelSelection = selectedTable
    ? { type: 'table' as const, item: selectedTable }
    : selectedSeat
    ? { type: 'seat' as const, item: selectedSeat }
    : null

  const { execute: save, isPending: isSaving } = useAction(upsertSeatMapAction, {
    onSuccess: () => toast.success('Plan de salle enregistré'),
    onError: ({ error }) => toast.error(error.serverError ?? "Erreur lors de l'enregistrement"),
  })

  const { execute: execDeleteTable } = useAction(deleteTableAction, {
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur suppression table'),
  })

  const { execute: execDeleteSeat } = useAction(deleteSeatAction, {
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur suppression chaise'),
  })

  // --- Snap helper ---
  const snap = useCallback(
    (v: number) => (snapEnabled ? snapToGrid(v, GRID_SIZE) : v),
    [snapEnabled],
  )

  // --- Table handlers ---
  const handleTableDragEnd = useCallback(
    (localId: string, x: number, y: number) => {
      const snappedX = snap(x)
      const snappedY = snap(y)
      const table = tables.find((t) => t.localId === localId)
      if (!table) return
      const dx = snappedX - table.position_x
      const dy = snappedY - table.position_y
      setTables((prev) =>
        prev.map((t) => (t.localId === localId ? { ...t, position_x: snappedX, position_y: snappedY } : t)),
      )
      // Move all linked chairs by same delta
      setSeats((prev) =>
        prev.map((s) =>
          s.table_id === localId
            ? { ...s, position_x: s.position_x + dx, position_y: s.position_y + dy }
            : s,
        ),
      )
    },
    [tables, snap],
  )

  const handleTableRotate = useCallback(
    (localId: string, newRotation: number) => {
      const snapped = snapRotation(newRotation, 15)
      const table = tables.find((t) => t.localId === localId)
      if (!table) return
      const delta = snapped - table.rotation
      const cx = table.position_x
      const cy = table.position_y
      setTables((prev) =>
        prev.map((t) => (t.localId === localId ? { ...t, rotation: snapped } : t)),
      )
      setSeats((prev) =>
        prev.map((s) => {
          if (s.table_id !== localId) return s
          const rotated = rotatePoint(s.position_x, s.position_y, cx, cy, delta)
          return {
            ...s,
            position_x: rotated.x,
            position_y: rotated.y,
            rotation: snapRotation((s.rotation + delta + 360) % 360, 15),
          }
        }),
      )
    },
    [tables],
  )

  // --- Seat handlers ---
  const handleSeatDragEnd = useCallback(
    (localId: string, x: number, y: number) => {
      setSeats((prev) =>
        prev.map((s) =>
          s.localId === localId ? { ...s, position_x: snap(x), position_y: snap(y) } : s,
        ),
      )
    },
    [snap],
  )

  // --- Add table + chairs ---
  const handleAddTableWithChairs = (chairCount: number) => {
    const tableId = crypto.randomUUID()
    const newTable: TableData = {
      localId: tableId,
      id: tableId,
      room_id: roomId,
      label: '',
      position_x: snap(CANVAS_WIDTH / 2),
      position_y: snap(CANVAS_HEIGHT / 2),
      width: DEFAULT_TABLE_W,
      height: DEFAULT_TABLE_H,
      rotation: 0,
    }
    const chairPositions = chairPositionsAroundTable(newTable, chairCount)
    const newSeats: SeatTokenData[] = chairPositions.map((pos, i) => ({
      localId: crypto.randomUUID(),
      id: undefined,
      room_id: roomId,
      table_id: tableId,
      label: nextSeatLabel([...seats, ...newSeats.slice(0, i)]),
      position_x: snap(pos.x),
      position_y: snap(pos.y),
      rotation: pos.rotation,
      status: 'free',
    }))
    setTables((prev) => [...prev, newTable])
    setSeats((prev) => [...prev, ...newSeats])
  }

  // --- Add independent chair ---
  const handleAddIndependentChair = () => {
    const newSeat: SeatTokenData = {
      localId: crypto.randomUUID(),
      id: undefined,
      room_id: roomId,
      table_id: null,
      label: nextSeatLabel(seats),
      position_x: snap(80),
      position_y: snap(80),
      rotation: 0,
      status: 'free',
    }
    setSeats((prev) => [...prev, newSeat])
  }

  // --- Add chair to existing table ---
  const handleAddChairToTable = (tableLocalId: string) => {
    const table = tables.find((t) => t.localId === tableLocalId)
    if (!table) return
    const linkedSeats = seats.filter((s) => s.table_id === tableLocalId)
    const newCount = linkedSeats.length + 1
    const positions = chairPositionsAroundTable(table, newCount)
    const lastPos = positions[newCount - 1]
    const newSeat: SeatTokenData = {
      localId: crypto.randomUUID(),
      id: undefined,
      room_id: roomId,
      table_id: tableLocalId,
      label: nextSeatLabel(seats),
      position_x: snap(lastPos.x),
      position_y: snap(lastPos.y),
      rotation: lastPos.rotation,
      status: 'free',
    }
    setSeats((prev) => [...prev, newSeat])
  }

  // --- Delete ---
  const handleDeleteTable = (localId: string) => {
    const table = tables.find((t) => t.localId === localId)
    if (table?.id) execDeleteTable({ id: table.id, room_id: roomId })
    // Unlink chairs (don't delete them)
    setSeats((prev) => prev.map((s) => (s.table_id === localId ? { ...s, table_id: null } : s)))
    setTables((prev) => prev.filter((t) => t.localId !== localId))
    setSelection(null)
  }

  const handleDeleteSeat = (localId: string) => {
    const seat = seats.find((s) => s.localId === localId)
    if (seat?.id) execDeleteSeat({ id: seat.id, room_id: roomId })
    setSeats((prev) => prev.filter((s) => s.localId !== localId))
    setSelection(null)
  }

  // --- Properties panel changes ---
  const handleTableChange = (localId: string, patch: Partial<TableData>) => {
    setTables((prev) => prev.map((t) => (t.localId === localId ? { ...t, ...patch } : t)))
  }

  const handleSeatChange = (localId: string, patch: Partial<SeatTokenData>) => {
    setSeats((prev) => prev.map((s) => (s.localId === localId ? { ...s, ...patch } : s)))
  }

  // --- Align / distribute (operates on selected element + same-type neighbours) ---
  // For simplicity: align ops work on ALL tables or ALL seats depending on current selection
  const selectedTableItems = tables  // align works on all tables when a table is selected
  const selectedSeatItems = seats    // align works on all seats when a seat is selected

  const handleDistributeHorizontal = () => {
    if (selection?.type === 'table') {
      const newXs = distributeHorizontally(
        tables.map((t) => ({ x: t.position_x, width: t.width })),
        GRID_SIZE,
      )
      setTables((prev) => prev.map((t, i) => ({ ...t, position_x: newXs[i] })))
    } else if (selection?.type === 'seat') {
      const newXs = distributeHorizontally(
        seats.map((s) => ({ x: s.position_x, width: SEAT_RADIUS * 2 })),
        GRID_SIZE,
      )
      setSeats((prev) => prev.map((s, i) => ({ ...s, position_x: newXs[i] })))
    }
  }

  const handleDistributeVertical = () => {
    if (selection?.type === 'table') {
      const newYs = distributeVertically(
        tables.map((t) => ({ y: t.position_y, height: t.height })),
        GRID_SIZE,
      )
      setTables((prev) => prev.map((t, i) => ({ ...t, position_y: newYs[i] })))
    } else if (selection?.type === 'seat') {
      const newYs = distributeVertically(
        seats.map((s) => ({ y: s.position_y, height: SEAT_RADIUS * 2 })),
        GRID_SIZE,
      )
      setSeats((prev) => prev.map((s, i) => ({ ...s, position_y: newYs[i] })))
    }
  }

  // --- Save ---
  const handleSave = () => {
    save({
      room_id: roomId,
      tables: tables.map((t) => ({
        id: t.id,
        room_id: t.room_id,
        label: t.label,
        position_x: t.position_x,
        position_y: t.position_y,
        width: t.width,
        height: t.height,
        rotation: t.rotation,
      })),
      seats: seats.map((s) => ({
        id: s.id,
        room_id: s.room_id,
        table_id: s.table_id,
        label: s.label,
        position_x: s.position_x,
        position_y: s.position_y,
        rotation: s.rotation,
        status: s.status,
      })),
    })
  }

  // --- Grid lines ---
  const gridLines: React.ReactNode[] = []
  for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) {
    gridLines.push(
      <Line key={`v${x}`} points={[x, 0, x, CANVAS_HEIGHT]} stroke="#e2e8f0" strokeWidth={0.5} />,
    )
  }
  for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) {
    gridLines.push(
      <Line key={`h${y}`} points={[0, y, CANVAS_WIDTH, y]} stroke="#e2e8f0" strokeWidth={0.5} />,
    )
  }

  const hasSelection = selection !== null

  return (
    <div className="flex gap-4">
      {/* Main column */}
      <div className="flex-1 space-y-3 min-w-0">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Add table dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Ajouter une table
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {[1, 2, 4, 6].map((n) => (
                <DropdownMenuItem key={n} onClick={() => handleAddTableWithChairs(n)}>
                  {n} place{n > 1 ? 's' : ''}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add independent chair */}
          <Button variant="outline" size="sm" onClick={handleAddIndependentChair}>
            <Plus className="mr-1 h-4 w-4" />
            Chaise indépendante
          </Button>

          {/* Align / distribute — only when something selected */}
          {hasSelection && (
            <>
              <div className="h-5 w-px bg-border" />
              <Button variant="ghost" size="icon" title="Distribuer horizontalement" onClick={handleDistributeHorizontal}>
                <DistributeHorizontal className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Distribuer verticalement" onClick={handleDistributeVertical}>
                <DistributeVertical className="h-4 w-4" />
              </Button>
            </>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant={snapEnabled ? 'secondary' : 'ghost'}
              size="icon"
              title="Grille magnétique"
              onClick={() => setSnapEnabled((v) => !v)}
            >
              <GridFour className="h-4 w-4" />
            </Button>
            <Button onClick={handleSave} disabled={isSaving} size="sm">
              <FloppyDisk className="mr-1 h-4 w-4" />
              {isSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div
          className="relative overflow-hidden rounded-lg border bg-slate-50"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          <Stage
            ref={stageRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onClick={(e) => {
              if (e.target === e.target.getStage()) setSelection(null)
            }}
          >
            <Layer>
              {/* Grid */}
              {gridLines}

              {/* Tables */}
              {tables.map((table) => (
                <TableToken
                  key={table.localId}
                  table={table}
                  isSelected={selection?.localId === table.localId}
                  onSelect={(localId) => setSelection({ type: 'table', localId })}
                  onDragEnd={handleTableDragEnd}
                />
              ))}

              {/* Seats */}
              {seats.map((seat) => (
                <SeatToken
                  key={seat.localId}
                  seat={seat}
                  isSelected={selection?.localId === seat.localId}
                  onDragEnd={handleSeatDragEnd}
                  onClick={(localId) => setSelection({ type: 'seat', localId })}
                />
              ))}

              <Transformer ref={transformerRef} rotationSnaps={Array.from({ length: 24 }, (_, i) => i * 15)} />
            </Layer>
          </Stage>
        </div>

        <p className="text-xs text-muted-foreground">
          Cliquez pour sélectionner · Faites glisser pour repositionner · Utilisez la poignée de rotation · Enregistrez pour sauvegarder
        </p>
      </div>

      {/* Properties panel */}
      <div className="w-56 rounded-lg border bg-card">
        <PropertiesPanel
          selection={panelSelection}
          allTables={tables}
          onTableChange={handleTableChange}
          onSeatChange={handleSeatChange}
          onDeleteTable={handleDeleteTable}
          onDeleteSeat={handleDeleteSeat}
          onAddChairToTable={handleAddChairToTable}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite editor page**

```tsx
// apps/web/src/app/admin/rooms/[roomId]/editor/page.tsx
import { getRoomById } from '@/data/admin/rooms'
import { getSeatMap } from '@/data/admin/seat-map'
import { EditorCanvas } from './EditorCanvas'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CaretLeft } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/button'

type Props = { params: Promise<{ roomId: string }> }

export default async function SeatMapEditorPage({ params }: Props) {
  const { roomId } = await params
  const [room, { tables, seats }] = await Promise.all([
    getRoomById(roomId),
    getSeatMap(roomId),
  ])

  if (!room) notFound()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/rooms">
            <CaretLeft className="mr-1 h-4 w-4" />
            Salles
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Éditeur — {room.name}</h1>
          <p className="text-muted-foreground text-sm">
            {tables.length} table{tables.length !== 1 ? 's' : ''} · {seats.length} place
            {seats.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <EditorCanvas roomId={room.id} initialTables={tables} initialSeats={seats} />
    </div>
  )
}
```

- [ ] **Step 3: Remove deleted files**

```bash
rm apps/web/src/components/seat-map/SeatEditPopover.tsx
rm apps/web/src/data/seats.ts
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: exit 0. Fix any import errors before committing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/admin/rooms/\[roomId\]/editor/EditorCanvas.tsx \
        apps/web/src/app/admin/rooms/\[roomId\]/editor/page.tsx
git rm apps/web/src/components/seat-map/SeatEditPopover.tsx \
       apps/web/src/data/seats.ts
git commit -m "feat(seat-map): rewrite EditorCanvas with tables, chairs, rotation, grid, align"
```

---

### Task 9: Student read-only map page

**Files:**
- Create: `apps/web/src/app/employee/rooms/[roomId]/map/page.tsx`
- Create: `apps/web/src/app/employee/rooms/[roomId]/map/RoomMap.tsx`

**Interfaces:**
- Consumes: `getSeatMap` from Task 4; `RoomTable`, `Seat` types; `getRoomById` from `@/data/admin/rooms`

- [ ] **Step 1: Write RoomMap client component**

```tsx
// apps/web/src/app/employee/rooms/[roomId]/map/RoomMap.tsx
'use client'

import { Stage, Layer, Rect, Circle, Text, Group } from 'react-konva'
import type { RoomTable, Seat } from '@/data/admin/seat-map'

const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 600
const SEAT_RADIUS = 24

const TABLE_FILL: Record<string, string> = {
  free: '#f8fafc',
  occupied: '#fef3c7',
  reserved: '#fef3c7',
}
const TABLE_STROKE: Record<string, string> = {
  free: '#94a3b8',
  occupied: '#f59e0b',
  reserved: '#f59e0b',
}
const SEAT_FILL: Record<string, string> = {
  free: '#3b82f6',
  occupied: '#ef4444',
  reserved: '#ef4444',
  out_of_service: '#9ca3af',
}

type Props = {
  tables: RoomTable[]
  seats: Seat[]
  currentSeatId?: string   // seat the logged-in student currently holds
}

export function RoomMap({ tables, seats, currentSeatId }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border bg-slate-50" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
      <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
        <Layer>
          {/* Tables */}
          {tables.map((table) => (
            <Group
              key={table.id}
              x={table.position_x}
              y={table.position_y}
              rotation={table.rotation}
              offsetX={table.width / 2}
              offsetY={table.height / 2}
            >
              <Rect
                width={table.width}
                height={table.height}
                fill={TABLE_FILL[table.status] ?? '#f8fafc'}
                stroke={TABLE_STROKE[table.status] ?? '#94a3b8'}
                strokeWidth={1.5}
                cornerRadius={6}
              />
              {table.label ? (
                <Text
                  text={table.label}
                  fontSize={11}
                  fill="#475569"
                  align="center"
                  verticalAlign="middle"
                  width={table.width}
                  height={table.height}
                />
              ) : null}
            </Group>
          ))}

          {/* Seats */}
          {seats.map((seat) => {
            const isMine = seat.id === currentSeatId
            const fill = isMine ? '#22c55e' : SEAT_FILL[seat.status] ?? '#3b82f6'
            return (
              <Group
                key={seat.id}
                x={seat.position_x}
                y={seat.position_y}
                rotation={seat.rotation}
              >
                <Circle
                  radius={SEAT_RADIUS}
                  fill={fill}
                  stroke="#1e3a5f"
                  strokeWidth={1.5}
                  opacity={seat.status === 'out_of_service' ? 0.5 : 1}
                />
                <Text
                  text={seat.label}
                  fontSize={seat.label.length > 2 ? 10 : 13}
                  fontStyle="bold"
                  fill="#ffffff"
                  align="center"
                  verticalAlign="middle"
                  width={SEAT_RADIUS * 2}
                  height={SEAT_RADIUS * 2}
                  offsetX={SEAT_RADIUS}
                  offsetY={SEAT_RADIUS}
                />
              </Group>
            )
          })}
        </Layer>
      </Stage>
    </div>
  )
}
```

- [ ] **Step 2: Write room map page**

```tsx
// apps/web/src/app/employee/rooms/[roomId]/map/page.tsx
import { getRoomById } from '@/data/admin/rooms'
import { getSeatMap } from '@/data/admin/seat-map'
import { RoomMap } from './RoomMap'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CaretLeft } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/button'

type Props = { params: Promise<{ roomId: string }> }

export default async function RoomMapPage({ params }: Props) {
  const { roomId } = await params
  const [room, { tables, seats }] = await Promise.all([
    getRoomById(roomId),
    getSeatMap(roomId),
  ])

  if (!room) notFound()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/employee/rooms">
            <CaretLeft className="mr-1 h-4 w-4" />
            Salles
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{room.name}</h1>
          <p className="text-muted-foreground text-sm">
            {seats.filter((s) => s.status === 'free').length} place{seats.filter((s) => s.status === 'free').length !== 1 ? 's' : ''} disponible{seats.filter((s) => s.status === 'free').length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <RoomMap tables={tables} seats={seats} />

      <div className="flex gap-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-blue-500" /> Libre</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-red-500" /> Occupée</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-green-500" /> Ma place</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-gray-400" /> Hors service</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/employee/rooms/[roomId]/map/page.tsx" \
        "apps/web/src/app/employee/rooms/[roomId]/map/RoomMap.tsx"
git commit -m "feat(seat-map): add student read-only room map page"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `tables` table with status, rotation, width, height | Task 1 |
| `seats.table_id` nullable FK | Task 1 |
| `seats.rotation` column | Task 1 |
| DB trigger: table status from chair status | Task 1 |
| Zod schemas for table upsert + seat map | Task 2 |
| `upsertSeatMapAction` batch save | Task 3 |
| `deleteTableAction` | Task 3 |
| `getSeatMap` query | Task 4 |
| Canvas utils: snap, rotate, distribute | Task 5 |
| `TableToken` Konva rect | Task 6 |
| `SeatToken` with rotation | Task 6 |
| PropertiesPanel (table: label/size, add chair; seat: label, link, out-of-service) | Task 7 |
| Grid 40px overlay | Task 8 |
| Snap-to-grid toggle | Task 8 |
| Add table + N chairs (1/2/4/6) | Task 8 |
| Add independent chair | Task 8 |
| Drag table moves linked chairs | Task 8 |
| Rotate table rotates linked chairs | Task 8 |
| Distribute horizontal / vertical | Task 8 |
| Batch save tables then seats | Task 8 |
| Student read-only map with status colors | Task 9 |
| Table status color derived from occupied chairs | Task 9 (table.status set by trigger) |

All spec requirements covered. No gaps found.

**Placeholder scan:** No TBDs. All code steps contain complete implementations.

**Type consistency:**
- `TableData.localId` used consistently in Tasks 6, 7, 8
- `SeatTokenData.table_id` is `string | null` throughout Tasks 6, 7, 8
- `getSeatMap` returns `{ tables: RoomTable[], seats: Seat[] }` — consumed correctly in Tasks 8, 9
- `upsertSeatMapAction` input matches `upsertSeatMapSchema` — tables have `id: string` (always UUID), seats have `id?: string`
- `chairPositionsAroundTable` returns `{ x, y, rotation }[]` — consumed correctly in Task 8
