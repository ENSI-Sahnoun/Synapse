# Phase 3D: Live Seat Map (Employee + Student) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Employee and student can view a real-time color-coded seat map for any room; employees can click a seat to manually assign a student; students can tap a green seat to initiate a reservation placeholder.

**Architecture:** A shared `LiveSeatMap` client component renders the same Konva layout as the editor but read-only, with seat colors driven by status. Supabase Realtime subscribes to `seats` table changes (filtered by `room_id`) via the browser client (`createSupabaseClient`). Color updates arrive as Realtime events and patch local state without a full re-fetch. Room capacity badges are computed from the live seat counts. Employee and student each get a route (`/employee/rooms/[roomId]/map` and `/student/rooms/[roomId]/map`) that renders `LiveSeatMap` with different interaction permissions passed as props. The employee "assign student" flow uses a `employeeActionClient` server action that sets `seat.status = 'occupied'` and creates an `attendance` row. The student tap opens a modal saying "Réservation — Phase 4" (placeholder per spec).

**Tech Stack:** react-konva, Supabase Realtime (browser client), next-safe-action, Zod, shadcn/ui (Badge, Dialog, Input, Button), React hooks

## Global Constraints

- Depends on Phase 3A (rooms + seats tables, Realtime publication), Phase 3B (room data, status badge), Phase 3C (SeatToken component, seat data query)
- Realtime subscription uses `createSupabaseClient` (browser client, not server client)
- Employee map: clicking a seat fires assign-student action; admin map reuses employee map
- Student map: tapping green seat shows placeholder modal (reservation engine is Phase 4)
- Closed/reserved rooms: student sees all seats grayed out + status note banner; reservation tap disabled
- Capacity badge computed from live counts, not DB query
- French UI
- All commands run from `/home/sah/Synapse`

---

### Task 1: Capacity badge utility

**Files:**
- Create: `apps/web/src/components/seat-map/CapacityBadge.tsx`

- [ ] **Step 1: Write CapacityBadge**

```tsx
// apps/web/src/components/seat-map/CapacityBadge.tsx
import { Badge } from '@/components/ui/badge'

type OccupancyLevel = 'empty' | 'quiet' | 'moderate' | 'nearly-full' | 'full'

const LEVEL_CONFIG: Record<OccupancyLevel, { label: string; className: string }> = {
  empty: {
    label: 'Vide',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  quiet: {
    label: 'Calme',
    className: 'bg-green-100 text-green-700 border-green-200',
  },
  moderate: {
    label: 'Modéré',
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  },
  'nearly-full': {
    label: 'Presque plein',
    className: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  full: {
    label: 'Complet',
    className: 'bg-red-100 text-red-700 border-red-200',
  },
}

function getOccupancyLevel(occupiedCount: number, totalSeats: number): OccupancyLevel {
  if (totalSeats === 0 || occupiedCount === 0) return 'empty'
  const pct = occupiedCount / totalSeats
  if (pct <= 0.40) return 'quiet'
  if (pct <= 0.70) return 'moderate'
  if (pct <= 0.90) return 'nearly-full'
  return 'full'
}

type Props = {
  occupiedCount: number
  totalSeats: number
  showCount?: boolean
}

export function CapacityBadge({ occupiedCount, totalSeats, showCount = true }: Props) {
  const level = getOccupancyLevel(occupiedCount, totalSeats)
  const config = LEVEL_CONFIG[level]

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
      {showCount && totalSeats > 0 && (
        <span className="ml-1 font-normal opacity-75">
          ({occupiedCount}/{totalSeats})
        </span>
      )}
    </Badge>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/seat-map/CapacityBadge.tsx
git commit -m "feat(map): add CapacityBadge with 5-level occupancy thresholds"
```

---

### Task 2: Live seat map Konva component

**Files:**
- Create: `apps/web/src/components/seat-map/LiveSeatMap.tsx`

- [ ] **Step 1: Write LiveSeatMap**

This component subscribes to Supabase Realtime on mount, patches seat state on events, and renders the canvas read-only with status-driven colors.

```tsx
// apps/web/src/components/seat-map/LiveSeatMap.tsx
'use client'

import { useEffect, useState } from 'react'
import { Stage, Layer, Rect, Circle, Text, Group } from 'react-konva'
import { createSupabaseClient } from '@/supabase-clients/client'
import { CapacityBadge } from './CapacityBadge'
import type { Seat } from '@/data/seats'
import type { Room } from '@/data/rooms'

const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 600
const SEAT_RADIUS = 24

// Status colors matching spec: green=free, red=occupied, orange=reserved, gray=out_of_service
const STATUS_COLOR: Record<string, string> = {
  free: '#22c55e',        // green-500
  occupied: '#ef4444',   // red-500
  reserved: '#f97316',   // orange-500
  out_of_service: '#9ca3af', // gray-400
}

type InteractionMode = 'employee' | 'student' | 'admin' | 'readonly'

type Props = {
  room: Room
  initialSeats: Seat[]
  mode: InteractionMode
  onSeatClick?: (seat: Seat) => void   // injected by parent for employee/student logic
}

export function LiveSeatMap({ room, initialSeats, mode, onSeatClick }: Props) {
  const [seats, setSeats] = useState<Seat[]>(initialSeats)

  const occupiedCount = seats.filter((s) => s.status === 'occupied').length
  const isRoomClosed = room.status === 'closed' || room.status === 'reserved'

  // Supabase Realtime subscription on seats table filtered by room_id
  useEffect(() => {
    const supabase = createSupabaseClient()

    const channel = supabase
      .channel(`seats:room_id=eq.${room.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'seats',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Seat
            setSeats((prev) =>
              prev.map((s) => (s.id === updated.id ? updated : s)),
            )
          } else if (payload.eventType === 'INSERT') {
            const inserted = payload.new as Seat
            setSeats((prev) => {
              if (prev.find((s) => s.id === inserted.id)) return prev
              return [...prev, inserted]
            })
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string }
            setSeats((prev) => prev.filter((s) => s.id !== deleted.id))
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [room.id])

  function handleSeatClick(seat: Seat) {
    if (mode === 'readonly' || mode === 'admin') return
    // Students: only green seats are clickable
    if (mode === 'student' && seat.status !== 'free') return
    if (mode === 'student' && isRoomClosed) return
    onSeatClick?.(seat)
  }

  return (
    <div className="space-y-3">
      {/* Room header + capacity badge */}
      <div className="flex items-center gap-3">
        <h2 className="font-semibold">{room.name}</h2>
        <CapacityBadge occupiedCount={occupiedCount} totalSeats={seats.length} />
      </div>

      {/* Closed/reserved room banner */}
      {isRoomClosed && (
        <div className="rounded-md border border-orange-200 bg-orange-50 px-4 py-2 text-sm text-orange-800">
          <span className="font-medium">
            {room.status === 'closed' ? 'Salle fermée' : 'Salle réservée'}
          </span>
          {room.status_note && <span className="ml-2">— {room.status_note}</span>}
        </div>
      )}

      {/* Canvas */}
      <div className="overflow-hidden rounded-lg border bg-slate-50" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
        <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
          <Layer>
            {/* Transparent background to capture deselect clicks */}
            <Rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="transparent" />

            {seats.map((seat) => {
              // In closed/reserved rooms, show everything grayed to students
              const effectiveStatus =
                isRoomClosed && mode === 'student' ? 'out_of_service' : seat.status
              const fill = STATUS_COLOR[effectiveStatus] ?? STATUS_COLOR.free

              const isClickable =
                mode === 'employee' ||
                (mode === 'student' && seat.status === 'free' && !isRoomClosed)

              return (
                <Group
                  key={seat.id}
                  x={seat.position_x}
                  y={seat.position_y}
                  onClick={() => handleSeatClick(seat)}
                  onTap={() => handleSeatClick(seat)}
                  style={{ cursor: isClickable ? 'pointer' : 'default' }}
                >
                  <Circle
                    radius={SEAT_RADIUS}
                    fill={fill}
                    stroke="#1e3a5f"
                    strokeWidth={1.5}
                    opacity={effectiveStatus === 'out_of_service' ? 0.45 : 1}
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

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-green-500" /> Libre
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" /> Occupée
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-orange-500" /> Réservée
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-gray-400" /> Hors service
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/seat-map/LiveSeatMap.tsx
git commit -m "feat(map): add LiveSeatMap with Supabase Realtime subscription"
```

---

### Task 3: Employee assign-student action

**Files:**
- Create: `apps/web/src/utils/zod-schemas/attendance.ts`
- Create: `apps/web/src/actions/attendance.ts`

- [ ] **Step 1: Write attendance Zod schemas**

```typescript
// apps/web/src/utils/zod-schemas/attendance.ts
import { z } from 'zod'

export const assignSeatSchema = z.object({
  student_id: z.string().uuid(),
  seat_id: z.string().uuid(),
  room_id: z.string().uuid(),
})

export type AssignSeatInput = z.infer<typeof assignSeatSchema>
```

- [ ] **Step 2: Write assign-seat server action**

```typescript
// apps/web/src/actions/attendance.ts
'use server'

import { employeeActionClient } from '@/actions/safe-action'
import { createSupabaseServerClient } from '@/supabase-clients/server'
import { assignSeatSchema } from '@/utils/zod-schemas/attendance'
import { revalidatePath } from 'next/cache'

// Employee manually assigns a student to a seat (walk-in override)
// Sets seat status → occupied, creates attendance row
export const assignSeatAction = employeeActionClient
  .schema(assignSeatSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseServerClient()

    // Mark seat occupied
    const { error: seatError } = await supabase
      .from('seats')
      .update({ status: 'occupied' })
      .eq('id', parsedInput.seat_id)
      .eq('room_id', parsedInput.room_id)

    if (seatError) throw new Error(seatError.message)

    // Create attendance record (check-out handled in Phase 4 / kiosk checkout)
    const { data, error: attendanceError } = await supabase
      .from('attendance')
      .insert({
        student_id: parsedInput.student_id,
        seat_id: parsedInput.seat_id,
        room_id: parsedInput.room_id,
        entry_method: 'manual',
      })
      .select()
      .single()

    if (attendanceError) {
      // Rollback seat status
      await supabase
        .from('seats')
        .update({ status: 'free' })
        .eq('id', parsedInput.seat_id)
      throw new Error(attendanceError.message)
    }

    revalidatePath(`/employee/rooms/${parsedInput.room_id}/map`)
    revalidatePath(`/admin/rooms/${parsedInput.room_id}/map`)
    return { attendance: data }
  })
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/utils/zod-schemas/attendance.ts apps/web/src/actions/attendance.ts
git commit -m "feat(map): add assignSeat server action for employee walk-in override"
```

---

### Task 4: Employee seat assignment modal

**Files:**
- Create: `apps/web/src/components/seat-map/AssignStudentDialog.tsx`

- [ ] **Step 1: Write AssignStudentDialog**

Employee clicks a seat → modal opens → employee searches for a student by name → confirms → `assignSeatAction` fires.

```tsx
// apps/web/src/components/seat-map/AssignStudentDialog.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { assignSeatAction } from '@/actions/attendance'
import { createSupabaseClient } from '@/supabase-clients/client'
import type { Seat } from '@/data/seats'

type StudentResult = { id: string; full_name: string; phone: string | null }

type Props = {
  seat: Seat | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AssignStudentDialog({ seat, open, onOpenChange }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StudentResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const { execute, isPending } = useAction(assignSeatAction, {
    onSuccess: () => {
      toast.success('Étudiant assigné à la place')
      onOpenChange(false)
      setQuery('')
      setResults([])
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur lors de l\'assignation')
    },
  })

  // Debounced student search
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }

    const timeout = setTimeout(async () => {
      setIsSearching(true)
      const supabase = createSupabaseClient()
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('role', 'student')
        .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(8)

      setResults((data as StudentResult[]) ?? [])
      setIsSearching(false)
    }, 300)

    return () => clearTimeout(timeout)
  }, [query])

  function handleAssign(student: StudentResult) {
    if (!seat) return
    execute({
      student_id: student.id,
      seat_id: seat.id,
      room_id: seat.room_id,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Assigner un étudiant — Place {seat?.label}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Rechercher par nom ou téléphone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />

          {isSearching && (
            <p className="text-muted-foreground text-sm">Recherche…</p>
          )}

          {results.length > 0 && (
            <ul className="divide-y rounded-md border">
              {results.map((student) => (
                <li key={student.id}>
                  <button
                    type="button"
                    className="hover:bg-muted flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                    onClick={() => handleAssign(student)}
                    disabled={isPending}
                  >
                    <span className="font-medium">{student.full_name}</span>
                    {student.phone && (
                      <span className="text-muted-foreground">{student.phone}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {query.length >= 2 && !isSearching && results.length === 0 && (
            <p className="text-muted-foreground text-sm">Aucun étudiant trouvé.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/seat-map/AssignStudentDialog.tsx
git commit -m "feat(map): add AssignStudentDialog for employee walk-in assignment"
```

---

### Task 5: Student reservation placeholder modal

**Files:**
- Create: `apps/web/src/components/seat-map/ReservationPlaceholderDialog.tsx`

- [ ] **Step 1: Write placeholder dialog**

Per spec: "Student can tap green seat → initiates reservation (placeholder, full in Phase 4)."

```tsx
// apps/web/src/components/seat-map/ReservationPlaceholderDialog.tsx
'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Clock } from 'lucide-react'
import type { Seat } from '@/data/seats'

type Props = {
  seat: Seat | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReservationPlaceholderDialog({ seat, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm text-center">
        <DialogHeader className="items-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
            <Clock className="h-6 w-6 text-orange-600" />
          </div>
          <DialogTitle>Réserver la place {seat?.label}</DialogTitle>
          <DialogDescription>
            La réservation en ligne sera disponible prochainement. Veuillez vous adresser
            à un employé pour réserver cette place.
          </DialogDescription>
        </DialogHeader>
        <Button variant="outline" onClick={() => onOpenChange(false)} className="mt-2">
          Fermer
        </Button>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/seat-map/ReservationPlaceholderDialog.tsx
git commit -m "feat(map): add reservation placeholder dialog for student seat tap"
```

---

### Task 6: Employee live seat map page

**Files:**
- Create: `apps/web/src/app/(app-pages)/employee/rooms/[roomId]/map/page.tsx`
- Create: `apps/web/src/app/(app-pages)/employee/rooms/[roomId]/map/EmployeeMapClient.tsx`

- [ ] **Step 1: Write EmployeeMapClient**

```tsx
// apps/web/src/app/(app-pages)/employee/rooms/[roomId]/map/EmployeeMapClient.tsx
'use client'

import { useState } from 'react'
import { LiveSeatMap } from '@/components/seat-map/LiveSeatMap'
import { AssignStudentDialog } from '@/components/seat-map/AssignStudentDialog'
import type { Seat } from '@/data/seats'
import type { Room } from '@/data/rooms'

type Props = {
  room: Room
  initialSeats: Seat[]
}

export function EmployeeMapClient({ room, initialSeats }: Props) {
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  function handleSeatClick(seat: Seat) {
    // Employee can click free or reserved seats to manually assign
    if (seat.status === 'out_of_service') return
    setSelectedSeat(seat)
    setDialogOpen(true)
  }

  return (
    <>
      <LiveSeatMap
        room={room}
        initialSeats={initialSeats}
        mode="employee"
        onSeatClick={handleSeatClick}
      />
      <AssignStudentDialog
        seat={selectedSeat}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  )
}
```

- [ ] **Step 2: Write employee map page (RSC)**

```tsx
// apps/web/src/app/(app-pages)/employee/rooms/[roomId]/map/page.tsx
import { getRoomById } from '@/data/rooms'
import { getSeatsByRoom } from '@/data/seats'
import { EmployeeMapClient } from './EmployeeMapClient'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'

type Props = { params: { roomId: string } }

export default async function EmployeeSeatMapPage({ params }: Props) {
  const [room, seats] = await Promise.all([
    getRoomById(params.roomId),
    getSeatsByRoom(params.roomId),
  ])

  if (!room) notFound()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/employee/rooms">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Salles
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Plan de salle — {room.name}</h1>
      </div>
      <EmployeeMapClient room={room} initialSeats={seats} />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(app-pages)/employee/rooms/[roomId]/map/
git commit -m "feat(map): add employee live seat map page with assign-student dialog"
```

---

### Task 7: Student live seat map page

**Files:**
- Create: `apps/web/src/app/(app-pages)/student/rooms/[roomId]/map/page.tsx`
- Create: `apps/web/src/app/(app-pages)/student/rooms/[roomId]/map/StudentMapClient.tsx`

- [ ] **Step 1: Write StudentMapClient**

```tsx
// apps/web/src/app/(app-pages)/student/rooms/[roomId]/map/StudentMapClient.tsx
'use client'

import { useState } from 'react'
import { LiveSeatMap } from '@/components/seat-map/LiveSeatMap'
import { ReservationPlaceholderDialog } from '@/components/seat-map/ReservationPlaceholderDialog'
import type { Seat } from '@/data/seats'
import type { Room } from '@/data/rooms'

type Props = {
  room: Room
  initialSeats: Seat[]
}

export function StudentMapClient({ room, initialSeats }: Props) {
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  function handleSeatClick(seat: Seat) {
    setSelectedSeat(seat)
    setDialogOpen(true)
  }

  return (
    <>
      <LiveSeatMap
        room={room}
        initialSeats={initialSeats}
        mode="student"
        onSeatClick={handleSeatClick}
      />
      <ReservationPlaceholderDialog
        seat={selectedSeat}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  )
}
```

- [ ] **Step 2: Write student map page (RSC)**

```tsx
// apps/web/src/app/(app-pages)/student/rooms/[roomId]/map/page.tsx
import { getRoomById } from '@/data/rooms'
import { getSeatsByRoom } from '@/data/seats'
import { StudentMapClient } from './StudentMapClient'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'

type Props = { params: { roomId: string } }

export default async function StudentSeatMapPage({ params }: Props) {
  const [room, seats] = await Promise.all([
    getRoomById(params.roomId),
    getSeatsByRoom(params.roomId),
  ])

  if (!room) notFound()

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/student/rooms">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Salles
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">{room.name}</h1>
      </div>
      <StudentMapClient room={room} initialSeats={seats} />
    </div>
  )
}
```

- [ ] **Step 3: Write student rooms list page (entry point)**

```tsx
// apps/web/src/app/(app-pages)/student/rooms/page.tsx
import { getRooms } from '@/data/rooms'
import { RoomStatusBadge } from '@/app/(app-pages)/admin/rooms/RoomStatusBadge'
import { CapacityBadge } from '@/components/seat-map/CapacityBadge'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { createSupabaseServerClient } from '@/supabase-clients/server'

export default async function StudentRoomsPage() {
  const supabase = await createSupabaseServerClient()

  // Fetch rooms with seat counts in one query
  const { data: roomsData } = await supabase
    .from('rooms')
    .select('*, seats ( id, status )')
    .order('name')

  const rooms = (roomsData ?? []).map((r) => {
    const seatRows = (r.seats ?? []) as { id: string; status: string }[]
    return {
      ...r,
      seat_count: seatRows.length,
      occupied_count: seatRows.filter((s) => s.status === 'occupied').length,
    }
  })

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Salles disponibles</h1>

      <ul className="space-y-2">
        {rooms.map((room) => (
          <li key={room.id}>
            <Link
              href={`/student/rooms/${room.id}/map`}
              className="flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="space-y-1">
                <p className="font-medium">{room.name}</p>
                <div className="flex items-center gap-2">
                  <RoomStatusBadge status={room.status as 'open' | 'closed' | 'reserved'} />
                  <CapacityBadge
                    occupiedCount={room.occupied_count}
                    totalSeats={room.seat_count}
                    showCount
                  />
                </div>
                {room.status_note && (
                  <p className="text-muted-foreground text-xs">{room.status_note}</p>
                )}
              </div>
              <ChevronRight className="text-muted-foreground h-5 w-5 flex-shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(app-pages)/student/rooms/
git commit -m "feat(map): add student live seat map page and rooms list"
```

---

### Task 8: Smoke-test Realtime updates locally

**Files:** No new files — verification step.

- [ ] **Step 1: Start dev server**

```bash
cd /home/sah/Synapse && pnpm dev
```

Expected: Next.js starts on `http://localhost:3000`.

- [ ] **Step 2: Insert a test room and seats via Supabase Studio**

Open `http://localhost:54323` (Supabase Studio local), navigate to Table Editor → `rooms`, insert:
```json
{ "name": "Salle test", "capacity": 5, "status": "open" }
```

Then in `seats`, insert 3 seats with `room_id` = the new room UUID, labels `A1`, `A2`, `A3`, `position_x` 100/200/300, `position_y` 200, `status` `free`.

- [ ] **Step 3: Open employee map in two browser tabs**

Navigate to `http://localhost:3000/employee/rooms/<roomId>/map` in two tabs.

In Supabase Studio, UPDATE `seats` set `status = 'occupied'` for `A1`. Both tabs should update the A1 token to red within 2 seconds.

- [ ] **Step 4: Verify capacity badge updates**

After step 3, the `CapacityBadge` in both tabs should show `Calme (1/3)` (1 occupied out of 3, = 33%, = quiet).

- [ ] **Step 5: Commit verification note (no file changes needed)**

```bash
git commit --allow-empty -m "chore(map): verify Realtime seat updates work in local dev"
```

---

## Self-Review

| Spec requirement | Covered |
|---|---|
| Live seat map read-only render of same layout | ✅ `LiveSeatMap` uses same Konva circles + labels |
| Realtime color updates via Supabase Realtime on `seats` | ✅ Task 2 — channel subscription patches local state on INSERT/UPDATE/DELETE |
| Colors: green=free, red=occupied, orange=reserved, gray=out_of_service | ✅ `STATUS_COLOR` in `LiveSeatMap` |
| Employee clicks seat → manually assign student | ✅ Tasks 3 + 4 — `assignSeatAction` + `AssignStudentDialog` |
| Student taps green seat → reservation placeholder modal | ✅ Tasks 5 + 7 — `ReservationPlaceholderDialog` |
| Room capacity badges (Empty/Quiet/Moderate/Nearly Full/Full) | ✅ Task 1 `CapacityBadge` with 5 thresholds matching spec |
| Badges updated via Realtime | ✅ Badge reads from live `seats` state which is patched by Realtime events |
| Closed/reserved rooms: seats hidden from reservation, shown grayed | ✅ `LiveSeatMap` applies `out_of_service` effective status when `isRoomClosed && mode === 'student'` |
| Closed/reserved: status_note shown to students | ✅ Orange banner in `LiveSeatMap` with `status_note` |
| Employee route `/employee/rooms/[roomId]/map` | ✅ Task 6 |
| Student route `/student/rooms/[roomId]/map` | ✅ Task 7 |
| Student rooms list page with capacity + status badges | ✅ Task 7 Step 3 |
| `assignSeatAction` creates `attendance` row | ✅ Task 3 Step 2 |
| Supabase browser client used for Realtime (not server client) | ✅ `createSupabaseClient` in `LiveSeatMap` |
