# Phase 3C: Admin Seat Map Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin can drag seat tokens onto a react-konva canvas at `/admin/rooms/[roomId]/editor`, label them, mark them out of service, and persist positions via server action.

**Architecture:** The editor page is a Next.js Client Component (Konva requires DOM/canvas). It fetches the room and existing seats on mount via a server action, then renders a Konva `Stage` + `Layer`. Each seat is a Konva `Group` (circle + text label). Dragging fires `onDragEnd` which updates local state; clicking a seat opens a popover to edit label or toggle out-of-service. A single "Enregistrer" button calls a batch `upsertSeatsAction` that saves all seat positions and metadata. The "Ajouter une place" button appends a new seat token at the top-left of the canvas (position 50, 50 + offset) and the user drags it into position.

**Tech Stack:** react-konva, konva, next-safe-action, Zod, shadcn/ui (Button, Input, Popover, Switch, Badge), React hooks

## Global Constraints

- Depends on Phase 3A (rooms + seats tables) and Phase 3B (room data queries, Zod schemas)
- `react-konva` requires `'use client'` — the editor page is fully client-side
- `adminActionClient` for all seat mutations (seat layout is admin-only)
- Canvas size: 900×600 px at 1x (scales responsively with CSS `transform: scale`)
- Seat token: circle radius 24px; label centered inside; color gray when out_of_service, blue when active
- All commands run from `/home/sah/Synapse`
- French UI

---

### Task 1: Install react-konva

**Files:**
- Modify: `apps/web/package.json` (dependency added via pnpm)

- [ ] **Step 1: Install packages**

```bash
cd /home/sah/Synapse && pnpm --filter web add konva react-konva
```

Expected: `konva` and `react-konva` added to `apps/web/package.json` dependencies.

- [ ] **Step 2: Verify install**

```bash
cd /home/sah/Synapse && pnpm --filter web list konva react-konva
```

Expected: both packages listed with version numbers.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml pnpm-lock.yaml
git commit -m "feat(editor): install konva + react-konva for seat map editor"
```

---

### Task 2: Zod schemas and server actions for seat management

**Files:**
- Create: `apps/web/src/utils/zod-schemas/seat.ts`
- Create: `apps/web/src/actions/seats.ts`

- [ ] **Step 1: Write seat Zod schemas**

```typescript
// apps/web/src/utils/zod-schemas/seat.ts
import { z } from 'zod'

export const seatUpsertItemSchema = z.object({
  id: z.string().uuid().optional(),   // undefined = new seat to insert
  room_id: z.string().uuid(),
  label: z.string().min(1, 'Étiquette requise').max(10, 'Max 10 caractères'),
  position_x: z.number(),
  position_y: z.number(),
  status: z.enum(['free', 'occupied', 'reserved', 'out_of_service']),
})

export type SeatUpsertItem = z.infer<typeof seatUpsertItemSchema>

export const upsertSeatsSchema = z.object({
  room_id: z.string().uuid(),
  seats: z.array(seatUpsertItemSchema).min(1, 'Au moins une place requise'),
})

export type UpsertSeatsInput = z.infer<typeof upsertSeatsSchema>

export const deleteSeatSchema = z.object({
  id: z.string().uuid(),
  room_id: z.string().uuid(),
})

export type DeleteSeatInput = z.infer<typeof deleteSeatSchema>
```

- [ ] **Step 2: Write seat server actions**

```typescript
// apps/web/src/actions/seats.ts
'use server'

import { adminActionClient } from '@/actions/safe-action'
import { createSupabaseServerClient } from '@/supabase-clients/server'
import { upsertSeatsSchema, deleteSeatSchema } from '@/utils/zod-schemas/seat'
import { revalidatePath } from 'next/cache'

// Admin: batch upsert all seats in a room (saves positions + labels + out-of-service)
export const upsertSeatsAction = adminActionClient
  .schema(upsertSeatsSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseServerClient()

    const rows = parsedInput.seats.map((s) => ({
      ...(s.id ? { id: s.id } : {}),
      room_id: s.room_id,
      label: s.label,
      position_x: s.position_x,
      position_y: s.position_y,
      status: s.status,
    }))

    const { data, error } = await supabase
      .from('seats')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: false })
      .select()

    if (error) throw new Error(error.message)

    revalidatePath(`/admin/rooms/${parsedInput.room_id}/editor`)
    revalidatePath(`/admin/rooms/${parsedInput.room_id}/map`)
    revalidatePath(`/employee/rooms/${parsedInput.room_id}/map`)
    return { seats: data }
  })

// Admin: delete a single seat from a room
export const deleteSeatAction = adminActionClient
  .schema(deleteSeatSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseServerClient()
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

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/utils/zod-schemas/seat.ts apps/web/src/actions/seats.ts
git commit -m "feat(editor): add seat upsert/delete schemas and server actions"
```

---

### Task 3: Seat data query function

**Files:**
- Create: `apps/web/src/data/seats.ts`

- [ ] **Step 1: Write seat data queries**

```typescript
// apps/web/src/data/seats.ts
import { createSupabaseServerClient } from '@/supabase-clients/server'
import type { Database } from '@/lib/database.types'

export type Seat = Database['public']['Tables']['seats']['Row']

export async function getSeatsByRoom(roomId: string): Promise<Seat[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('seats')
    .select('*')
    .eq('room_id', roomId)
    .order('label')

  if (error) throw new Error(error.message)
  return data
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/data/seats.ts
git commit -m "feat(editor): add seat data query function"
```

---

### Task 4: Seat token Konva component

**Files:**
- Create: `apps/web/src/components/seat-map/SeatToken.tsx`

- [ ] **Step 1: Write SeatToken component**

```tsx
// apps/web/src/components/seat-map/SeatToken.tsx
'use client'

import { Group, Circle, Text } from 'react-konva'
import type Konva from 'konva'

export type SeatTokenData = {
  id: string | undefined      // undefined for unsaved new seats
  room_id: string
  label: string
  position_x: number
  position_y: number
  status: 'free' | 'occupied' | 'reserved' | 'out_of_service'
}

const STATUS_FILL: Record<SeatTokenData['status'], string> = {
  free: '#3b82f6',             // blue-500 — in editor, all active seats are blue
  occupied: '#3b82f6',
  reserved: '#3b82f6',
  out_of_service: '#9ca3af',  // gray-400
}

const RADIUS = 24

type Props = {
  seat: SeatTokenData
  isSelected: boolean
  onDragEnd: (id: string | undefined, x: number, y: number) => void
  onClick: (id: string | undefined) => void
}

export function SeatToken({ seat, isSelected, onDragEnd, onClick }: Props) {
  const fill = seat.status === 'out_of_service' ? STATUS_FILL.out_of_service : STATUS_FILL.free
  const strokeColor = isSelected ? '#f59e0b' : '#1e3a5f'

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    onDragEnd(seat.id, e.target.x(), e.target.y())
  }

  return (
    <Group
      x={seat.position_x}
      y={seat.position_y}
      draggable
      onDragEnd={handleDragEnd}
      onClick={() => onClick(seat.id)}
      onTap={() => onClick(seat.id)}
    >
      <Circle
        radius={RADIUS}
        fill={fill}
        stroke={strokeColor}
        strokeWidth={isSelected ? 3 : 1.5}
        shadowBlur={isSelected ? 8 : 0}
        shadowColor="#f59e0b"
        opacity={seat.status === 'out_of_service' ? 0.5 : 1}
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

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/seat-map/SeatToken.tsx
git commit -m "feat(editor): add SeatToken Konva component"
```

---

### Task 5: Seat edit popover (label + out-of-service toggle)

**Files:**
- Create: `apps/web/src/components/seat-map/SeatEditPopover.tsx`

- [ ] **Step 1: Write SeatEditPopover**

```tsx
// apps/web/src/components/seat-map/SeatEditPopover.tsx
'use client'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import type { SeatTokenData } from './SeatToken'

type Props = {
  seat: SeatTokenData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  anchorRef: React.RefObject<HTMLDivElement>
  onLabelChange: (id: string | undefined, label: string) => void
  onOutOfServiceToggle: (id: string | undefined, outOfService: boolean) => void
  onDelete: (id: string | undefined) => void
}

export function SeatEditPopover({
  seat,
  open,
  onOpenChange,
  anchorRef,
  onLabelChange,
  onOutOfServiceToggle,
  onDelete,
}: Props) {
  if (!seat) return null

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {/* Invisible anchor div positioned over the canvas */}
        <div ref={anchorRef} className="absolute" />
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-4">
        <div className="space-y-1">
          <h4 className="font-medium">Modifier la place</h4>
        </div>
        <div className="space-y-2">
          <Label htmlFor="seat-label">Étiquette</Label>
          <Input
            id="seat-label"
            value={seat.label}
            maxLength={10}
            onChange={(e) => onLabelChange(seat.id, e.target.value)}
            placeholder="A1"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="out-of-service">Hors service</Label>
          <Switch
            id="out-of-service"
            checked={seat.status === 'out_of_service'}
            onCheckedChange={(checked) => onOutOfServiceToggle(seat.id, checked)}
          />
        </div>
        <div className="border-t pt-2">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => {
              onDelete(seat.id)
              onOpenChange(false)
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer la place
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/seat-map/SeatEditPopover.tsx
git commit -m "feat(editor): add SeatEditPopover for label and out-of-service toggle"
```

---

### Task 6: Seat map editor page

**Files:**
- Create: `apps/web/src/app/(app-pages)/admin/rooms/[roomId]/editor/page.tsx`
- Create: `apps/web/src/app/(app-pages)/admin/rooms/[roomId]/editor/EditorCanvas.tsx`

- [ ] **Step 1: Write EditorCanvas (client component — all Konva logic)**

```tsx
// apps/web/src/app/(app-pages)/admin/rooms/[roomId]/editor/EditorCanvas.tsx
'use client'

import { useCallback, useRef, useState } from 'react'
import { Stage, Layer, Rect } from 'react-konva'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SeatToken, type SeatTokenData } from '@/components/seat-map/SeatToken'
import { SeatEditPopover } from '@/components/seat-map/SeatEditPopover'
import { upsertSeatsAction, deleteSeatAction } from '@/actions/seats'
import type { Seat } from '@/data/seats'
import { Plus, Save } from 'lucide-react'

const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 600
const SEAT_RADIUS = 24

// Convert DB seats to local token data (status override: editor always shows placement state)
function dbSeatToToken(s: Seat): SeatTokenData {
  return {
    id: s.id,
    room_id: s.room_id,
    label: s.label,
    position_x: s.position_x,
    position_y: s.position_y,
    status: s.status as SeatTokenData['status'],
  }
}

// Generate a next label like A1, A2, ... B1 based on existing labels
function nextLabel(existing: SeatTokenData[]): string {
  const labels = new Set(existing.map((s) => s.label))
  const rows = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (const row of rows) {
    for (let n = 1; n <= 20; n++) {
      const label = `${row}${n}`
      if (!labels.has(label)) return label
    }
  }
  return `P${existing.length + 1}`
}

type Props = {
  roomId: string
  initialSeats: Seat[]
}

export function EditorCanvas({ roomId, initialSeats }: Props) {
  const [seats, setSeats] = useState<SeatTokenData[]>(initialSeats.map(dbSeatToToken))
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const popoverAnchorRef = useRef<HTMLDivElement>(null!)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedSeat = seats.find((s) => s.id === selectedId) ?? null

  const { execute: saveSeats, isPending: isSaving } = useAction(upsertSeatsAction, {
    onSuccess: ({ data }) => {
      // Update local state with server-assigned IDs for new seats
      if (data?.seats) {
        setSeats(data.seats.map(dbSeatToToken))
      }
      toast.success('Plan de salle enregistré')
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur lors de l\'enregistrement')
    },
  })

  const { execute: deleteSeat } = useAction(deleteSeatAction, {
    onSuccess: () => {
      toast.success('Place supprimée')
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur lors de la suppression')
    },
  })

  const handleDragEnd = useCallback((id: string | undefined, x: number, y: number) => {
    // Clamp inside canvas
    const clampedX = Math.max(SEAT_RADIUS, Math.min(CANVAS_WIDTH - SEAT_RADIUS, x))
    const clampedY = Math.max(SEAT_RADIUS, Math.min(CANVAS_HEIGHT - SEAT_RADIUS, y))
    setSeats((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, position_x: clampedX, position_y: clampedY } : s,
      ),
    )
  }, [])

  const handleSeatClick = useCallback(
    (id: string | undefined) => {
      setSelectedId(id)
      setPopoverOpen(true)
    },
    [],
  )

  const handleAddSeat = () => {
    const label = nextLabel(seats)
    const newSeat: SeatTokenData = {
      id: undefined,
      room_id: roomId,
      label,
      position_x: 60 + (seats.length % 10) * 10,
      position_y: 60 + Math.floor(seats.length / 10) * 10,
      status: 'free',
    }
    setSeats((prev) => [...prev, newSeat])
    setSelectedId(undefined)
  }

  const handleLabelChange = (id: string | undefined, label: string) => {
    setSeats((prev) =>
      prev.map((s) => (s.id === id ? { ...s, label } : s)),
    )
  }

  const handleOutOfServiceToggle = (id: string | undefined, outOfService: boolean) => {
    setSeats((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: outOfService ? 'out_of_service' : 'free' } : s,
      ),
    )
  }

  const handleDelete = (id: string | undefined) => {
    if (id) {
      // Persisted seat — delete from DB
      deleteSeat({ id, room_id: roomId })
    }
    setSeats((prev) => prev.filter((s) => s.id !== id))
    setSelectedId(undefined)
  }

  const handleSave = () => {
    if (seats.length === 0) {
      toast.error('Ajoutez au moins une place avant d\'enregistrer')
      return
    }
    saveSeats({
      room_id: roomId,
      seats: seats.map((s) => ({
        id: s.id,
        room_id: roomId,
        label: s.label,
        position_x: s.position_x,
        position_y: s.position_y,
        status: s.status,
      })),
    })
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={handleAddSeat}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une place
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Enregistrement…' : 'Enregistrer le plan'}
        </Button>
        <span className="text-muted-foreground text-sm">
          {seats.length} place{seats.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-lg border bg-slate-50"
        style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
      >
        {/* Invisible popover anchor — repositioned via CSS when a seat is selected */}
        <div
          ref={popoverAnchorRef}
          className="pointer-events-none absolute"
          style={
            selectedSeat
              ? {
                  left: selectedSeat.position_x + SEAT_RADIUS,
                  top: selectedSeat.position_y - SEAT_RADIUS,
                }
              : { left: 0, top: 0 }
          }
        />

        <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
          <Layer>
            {/* Canvas background grid hint */}
            <Rect
              x={0}
              y={0}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              fill="transparent"
              onClick={() => {
                setSelectedId(undefined)
                setPopoverOpen(false)
              }}
            />
            {seats.map((seat) => (
              <SeatToken
                key={seat.id ?? seat.label}
                seat={seat}
                isSelected={seat.id === selectedId}
                onDragEnd={handleDragEnd}
                onClick={handleSeatClick}
              />
            ))}
          </Layer>
        </Stage>

        <SeatEditPopover
          seat={selectedSeat}
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
          anchorRef={popoverAnchorRef}
          onLabelChange={handleLabelChange}
          onOutOfServiceToggle={handleOutOfServiceToggle}
          onDelete={handleDelete}
        />
      </div>

      <p className="text-muted-foreground text-xs">
        Cliquez sur une place pour la modifier. Faites glisser pour la repositionner.
        Appuyez sur Enregistrer pour sauvegarder le plan.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Write editor page (RSC wrapper — fetches data, renders client EditorCanvas)**

```tsx
// apps/web/src/app/(app-pages)/admin/rooms/[roomId]/editor/page.tsx
import { getRoomById } from '@/data/rooms'
import { getSeatsByRoom } from '@/data/seats'
import { EditorCanvas } from './EditorCanvas'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = { params: { roomId: string } }

export default async function SeatMapEditorPage({ params }: Props) {
  const [room, seats] = await Promise.all([
    getRoomById(params.roomId),
    getSeatsByRoom(params.roomId),
  ])

  if (!room) notFound()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/rooms">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Salles
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Éditeur — {room.name}</h1>
          <p className="text-muted-foreground text-sm">
            Capacité déclarée : {room.capacity} places · {seats.length} place{seats.length !== 1 ? 's' : ''} positionnée{seats.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <EditorCanvas roomId={room.id} initialSeats={seats} />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(app-pages)/admin/rooms/[roomId]/editor/
git commit -m "feat(editor): add react-konva seat map editor page for admin"
```

---

## Self-Review

| Spec requirement | Covered |
|---|---|
| Route `/admin/rooms/[roomId]/editor` | ✅ Task 6 Step 2 |
| `react-konva` canvas drag-and-drop | ✅ Task 6 Step 1 — `draggable`, `onDragEnd`, position clamped to canvas |
| Admin creates seat tokens with auto-label | ✅ Task 6 Step 1 — `handleAddSeat` + `nextLabel()` |
| Drag saves `position_x/y` on drop | ✅ `handleDragEnd` updates local state; "Enregistrer" persists via `upsertSeatsAction` |
| Labels seats (A1, B3, etc.) | ✅ `SeatToken` renders label; `SeatEditPopover` allows rename |
| Marks seats out of service | ✅ `SeatEditPopover` Switch → `status: 'out_of_service'` |
| Batch save via server action | ✅ `upsertSeatsAction` with `onConflict: 'id'` |
| Delete individual seats | ✅ `deleteSeatAction` called from popover Delete button |
| Canvas 900×600 with seat radius 24px | ✅ constants in `EditorCanvas` |
| Gray color for out_of_service | ✅ `STATUS_FILL` in `SeatToken` |
| French UI | ✅ All labels and toasts in French |
| Back-link to rooms list | ✅ ChevronLeft → `/admin/rooms` |
