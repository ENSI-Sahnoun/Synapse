# Phase 3B: Admin Room Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin can create, rename, and delete rooms; set room capacity; and change room status (open/closed/reserved) with an optional status note — all from `/admin/rooms`.

**Architecture:** Server actions via `adminActionClient` (and `employeeActionClient` for status changes, since employees can also set room status per spec). Data fetching uses RSC with `createSupabaseServerClient`. The rooms list page is a React Server Component; the create/edit modals are client components using `next-safe-action` `useAction` hook. Zod schemas validate all inputs. Employee route at `/employee/rooms` reuses the status-change action but shows a read-only room list without create/delete controls.

**Tech Stack:** next-safe-action, Zod, shadcn/ui (Dialog, Form, Input, Select, Textarea, Badge, Table), React Server Components

## Global Constraints

- Depends on Phase 3A (rooms table + RLS) and Phase 1B (action clients, route layouts)
- `adminActionClient` for create/delete/rename/capacity changes; `employeeActionClient` for status changes
- French UI: all labels, toasts, and error messages in French
- No placeholders — all form fields and server actions are fully implemented
- All commands run from `/home/sah/Synapse`
- Room status badge colors: open=green, closed=red, reserved=orange

---

### Task 1: Zod schemas for room actions

**Files:**
- Create: `apps/web/src/utils/zod-schemas/room.ts`

- [ ] **Step 1: Write room Zod schemas**

```typescript
// apps/web/src/utils/zod-schemas/room.ts
import { z } from 'zod'

export const createRoomSchema = z.object({
  name: z.string().min(1, 'Nom de la salle requis'),
  capacity: z
    .number({ invalid_type_error: 'La capacité doit être un nombre' })
    .int('La capacité doit être un entier')
    .min(1, 'La capacité doit être au moins 1'),
})

export type CreateRoomInput = z.infer<typeof createRoomSchema>

export const updateRoomSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Nom de la salle requis').optional(),
  capacity: z
    .number({ invalid_type_error: 'La capacité doit être un nombre' })
    .int()
    .min(1)
    .optional(),
})

export type UpdateRoomInput = z.infer<typeof updateRoomSchema>

export const setRoomStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['open', 'closed', 'reserved']),
  status_note: z.string().max(200, 'Note trop longue (max 200 caractères)').optional(),
})

export type SetRoomStatusInput = z.infer<typeof setRoomStatusSchema>

export const deleteRoomSchema = z.object({
  id: z.string().uuid(),
})

export type DeleteRoomInput = z.infer<typeof deleteRoomSchema>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/utils/zod-schemas/room.ts
git commit -m "feat(rooms): add Zod schemas for room CRUD and status actions"
```

---

### Task 2: Server actions for room management

**Files:**
- Create: `apps/web/src/actions/rooms.ts`

- [ ] **Step 1: Write room server actions**

```typescript
// apps/web/src/actions/rooms.ts
'use server'

import { adminActionClient, employeeActionClient } from '@/actions/safe-action'
import { createSupabaseServerClient } from '@/supabase-clients/server'
import {
  createRoomSchema,
  updateRoomSchema,
  setRoomStatusSchema,
  deleteRoomSchema,
} from '@/utils/zod-schemas/room'
import { revalidatePath } from 'next/cache'

// Admin: create a new room
export const createRoomAction = adminActionClient
  .schema(createRoomSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        name: parsedInput.name,
        capacity: parsedInput.capacity,
        status: 'open',
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    revalidatePath('/admin/rooms')
    return { room: data }
  })

// Admin: update room name and/or capacity
export const updateRoomAction = adminActionClient
  .schema(updateRoomSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseServerClient()
    const updates: Record<string, unknown> = {}
    if (parsedInput.name !== undefined) updates.name = parsedInput.name
    if (parsedInput.capacity !== undefined) updates.capacity = parsedInput.capacity

    const { data, error } = await supabase
      .from('rooms')
      .update(updates)
      .eq('id', parsedInput.id)
      .select()
      .single()

    if (error) throw new Error(error.message)

    revalidatePath('/admin/rooms')
    revalidatePath(`/admin/rooms/${parsedInput.id}/editor`)
    return { room: data }
  })

// Admin or employee: set room status + optional note
export const setRoomStatusAction = employeeActionClient
  .schema(setRoomStatusSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('rooms')
      .update({
        status: parsedInput.status,
        status_note: parsedInput.status_note ?? null,
      })
      .eq('id', parsedInput.id)
      .select()
      .single()

    if (error) throw new Error(error.message)

    revalidatePath('/admin/rooms')
    revalidatePath('/employee/rooms')
    return { room: data }
  })

// Admin only: delete a room (cascades to seats via FK)
export const deleteRoomAction = adminActionClient
  .schema(deleteRoomSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', parsedInput.id)

    if (error) throw new Error(error.message)

    revalidatePath('/admin/rooms')
    return { deleted: true }
  })
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/actions/rooms.ts
git commit -m "feat(rooms): add server actions for room CRUD and status management"
```

---

### Task 3: Data query functions

**Files:**
- Create: `apps/web/src/data/rooms.ts`

- [ ] **Step 1: Write room data queries**

```typescript
// apps/web/src/data/rooms.ts
import { createSupabaseServerClient } from '@/supabase-clients/server'
import type { Database } from '@/lib/database.types'

export type Room = Database['public']['Tables']['rooms']['Row']
export type RoomWithSeatCount = Room & { seat_count: number; occupied_count: number }

export async function getRooms(): Promise<Room[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .order('name')

  if (error) throw new Error(error.message)
  return data
}

export async function getRoomById(id: string): Promise<Room | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

export async function getRoomsWithSeatCounts(): Promise<RoomWithSeatCount[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('rooms')
    .select(`
      *,
      seats!inner ( id, status )
    `)
    .order('name')

  if (error) {
    // No seats yet — return rooms with zero counts
    const rooms = await getRooms()
    return rooms.map((r) => ({ ...r, seat_count: 0, occupied_count: 0 }))
  }

  // Supabase returns nested seats array; aggregate here
  const result = (data as (Room & { seats: { id: string; status: string }[] })[]).map(
    (room) => ({
      ...room,
      seat_count: room.seats.length,
      occupied_count: room.seats.filter((s) => s.status === 'occupied').length,
    }),
  )
  return result
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/data/rooms.ts
git commit -m "feat(rooms): add room data query functions"
```

---

### Task 4: Admin rooms list page

**Files:**
- Create: `apps/web/src/app/(app-pages)/admin/rooms/page.tsx`
- Create: `apps/web/src/app/(app-pages)/admin/rooms/CreateRoomDialog.tsx`
- Create: `apps/web/src/app/(app-pages)/admin/rooms/EditRoomDialog.tsx`
- Create: `apps/web/src/app/(app-pages)/admin/rooms/SetRoomStatusDialog.tsx`
- Create: `apps/web/src/app/(app-pages)/admin/rooms/DeleteRoomButton.tsx`
- Create: `apps/web/src/app/(app-pages)/admin/rooms/RoomStatusBadge.tsx`

- [ ] **Step 1: Room status badge component**

```tsx
// apps/web/src/app/(app-pages)/admin/rooms/RoomStatusBadge.tsx
import { Badge } from '@/components/ui/badge'

const STATUS_CONFIG = {
  open: { label: 'Ouvert', variant: 'default' as const, className: 'bg-green-100 text-green-800 border-green-200' },
  closed: { label: 'Fermé', variant: 'destructive' as const, className: '' },
  reserved: { label: 'Réservé', variant: 'secondary' as const, className: 'bg-orange-100 text-orange-800 border-orange-200' },
}

export function RoomStatusBadge({ status }: { status: 'open' | 'closed' | 'reserved' }) {
  const config = STATUS_CONFIG[status]
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}
```

- [ ] **Step 2: Create room dialog (client component)**

```tsx
// apps/web/src/app/(app-pages)/admin/rooms/CreateRoomDialog.tsx
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createRoomSchema, type CreateRoomInput } from '@/utils/zod-schemas/room'
import { createRoomAction } from '@/actions/rooms'
import { Plus } from 'lucide-react'

export function CreateRoomDialog() {
  const [open, setOpen] = useState(false)

  const form = useForm<CreateRoomInput>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: { name: '', capacity: 10 },
  })

  const { execute, isPending } = useAction(createRoomAction, {
    onSuccess: () => {
      toast.success('Salle créée avec succès')
      form.reset()
      setOpen(false)
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur lors de la création')
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle salle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Créer une salle</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => execute(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de la salle</FormLabel>
                  <FormControl>
                    <Input placeholder="Salle principale" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacité (places)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Création…' : 'Créer'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Edit room dialog (rename + capacity)**

```tsx
// apps/web/src/app/(app-pages)/admin/rooms/EditRoomDialog.tsx
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateRoomSchema, type UpdateRoomInput } from '@/utils/zod-schemas/room'
import { updateRoomAction } from '@/actions/rooms'
import { Pencil } from 'lucide-react'
import type { Room } from '@/data/rooms'

export function EditRoomDialog({ room }: { room: Room }) {
  const [open, setOpen] = useState(false)

  const form = useForm<UpdateRoomInput>({
    resolver: zodResolver(updateRoomSchema),
    defaultValues: { id: room.id, name: room.name, capacity: room.capacity },
  })

  const { execute, isPending } = useAction(updateRoomAction, {
    onSuccess: () => {
      toast.success('Salle mise à jour')
      setOpen(false)
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur lors de la mise à jour')
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Modifier">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier la salle</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => execute(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de la salle</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacité (places)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Set room status dialog**

```tsx
// apps/web/src/app/(app-pages)/admin/rooms/SetRoomStatusDialog.tsx
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { setRoomStatusSchema, type SetRoomStatusInput } from '@/utils/zod-schemas/room'
import { setRoomStatusAction } from '@/actions/rooms'
import { Settings2 } from 'lucide-react'
import type { Room } from '@/data/rooms'

export function SetRoomStatusDialog({ room }: { room: Room }) {
  const [open, setOpen] = useState(false)

  const form = useForm<SetRoomStatusInput>({
    resolver: zodResolver(setRoomStatusSchema),
    defaultValues: {
      id: room.id,
      status: room.status as 'open' | 'closed' | 'reserved',
      status_note: room.status_note ?? '',
    },
  })

  const { execute, isPending } = useAction(setRoomStatusAction, {
    onSuccess: () => {
      toast.success('Statut mis à jour')
      setOpen(false)
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur lors du changement de statut')
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Changer le statut">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Statut de la salle — {room.name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => execute(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un statut" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="open">Ouvert</SelectItem>
                      <SelectItem value="closed">Fermé</SelectItem>
                      <SelectItem value="reserved">Réservé</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status_note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ex: Fermé pour maintenance jusqu'à 14h"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Enregistrement…' : 'Appliquer'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 5: Delete room button**

```tsx
// apps/web/src/app/(app-pages)/admin/rooms/DeleteRoomButton.tsx
'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { deleteRoomAction } from '@/actions/rooms'
import { Trash2 } from 'lucide-react'

export function DeleteRoomButton({ roomId, roomName }: { roomId: string; roomName: string }) {
  const { execute, isPending } = useAction(deleteRoomAction, {
    onSuccess: () => {
      toast.success(`Salle "${roomName}" supprimée`)
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur lors de la suppression')
    },
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Supprimer">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer la salle ?</AlertDialogTitle>
          <AlertDialogDescription>
            La salle <strong>{roomName}</strong> et toutes ses places seront supprimées définitivement. Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => execute({ id: roomId })}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Suppression…' : 'Supprimer'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 6: Admin rooms list page (RSC)**

```tsx
// apps/web/src/app/(app-pages)/admin/rooms/page.tsx
import { getRooms } from '@/data/rooms'
import { CreateRoomDialog } from './CreateRoomDialog'
import { EditRoomDialog } from './EditRoomDialog'
import { SetRoomStatusDialog } from './SetRoomStatusDialog'
import { DeleteRoomButton } from './DeleteRoomButton'
import { RoomStatusBadge } from './RoomStatusBadge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Map } from 'lucide-react'
import Link from 'next/link'

export default async function AdminRoomsPage() {
  const rooms = await getRooms()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Salles</h1>
          <p className="text-muted-foreground text-sm">
            {rooms.length} salle{rooms.length !== 1 ? 's' : ''} configurée{rooms.length !== 1 ? 's' : ''}
          </p>
        </div>
        <CreateRoomDialog />
      </div>

      {rooms.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center">
          <p className="text-lg font-medium">Aucune salle</p>
          <p className="text-sm">Créez votre première salle pour commencer.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead className="w-24 text-right">Capacité</TableHead>
                <TableHead className="w-32">Statut</TableHead>
                <TableHead>Note de statut</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell className="font-medium">{room.name}</TableCell>
                  <TableCell className="text-right">{room.capacity}</TableCell>
                  <TableCell>
                    <RoomStatusBadge status={room.status as 'open' | 'closed' | 'reserved'} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {room.status_note ?? '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Éditeur de plan" asChild>
                        <Link href={`/admin/rooms/${room.id}/editor`}>
                          <Map className="h-4 w-4" />
                        </Link>
                      </Button>
                      <SetRoomStatusDialog room={room} />
                      <EditRoomDialog room={room} />
                      <DeleteRoomButton roomId={room.id} roomName={room.name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Add rooms link to admin nav**

In `apps/web/src/app/(app-pages)/admin/` layout or sidebar nav file (check existing nav component path and pattern), add a "Salles" nav item pointing to `/admin/rooms` using the existing `NavLink` component pattern.

```tsx
// In the admin nav items array (exact file path depends on Phase 1B nav implementation):
{ href: '/admin/rooms', label: 'Salles', icon: Building2 }
// Import Building2 from 'lucide-react'
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/(app-pages)/admin/rooms/
git commit -m "feat(rooms): add admin rooms list page with CRUD and status management"
```

---

### Task 5: Employee rooms status page

**Files:**
- Create: `apps/web/src/app/(app-pages)/employee/rooms/page.tsx`

- [ ] **Step 1: Write employee rooms page (status change only, no delete/create)**

```tsx
// apps/web/src/app/(app-pages)/employee/rooms/page.tsx
import { getRooms } from '@/data/rooms'
import { SetRoomStatusDialog } from '@/app/(app-pages)/admin/rooms/SetRoomStatusDialog'
import { RoomStatusBadge } from '@/app/(app-pages)/admin/rooms/RoomStatusBadge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Map } from 'lucide-react'
import Link from 'next/link'

export default async function EmployeeRoomsPage() {
  const rooms = await getRooms()

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Salles</h1>
        <p className="text-muted-foreground text-sm">
          Consultez le statut des salles et modifiez-le si nécessaire.
        </p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead className="w-24 text-right">Capacité</TableHead>
              <TableHead className="w-32">Statut</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map((room) => (
              <TableRow key={room.id}>
                <TableCell className="font-medium">{room.name}</TableCell>
                <TableCell className="text-right">{room.capacity}</TableCell>
                <TableCell>
                  <RoomStatusBadge status={room.status as 'open' | 'closed' | 'reserved'} />
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {room.status_note ?? '—'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" title="Plan de salle" asChild>
                      <Link href={`/employee/rooms/${room.id}/map`}>
                        <Map className="h-4 w-4" />
                      </Link>
                    </Button>
                    <SetRoomStatusDialog room={room} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add rooms link to employee nav**

In the employee nav items array, add:
```tsx
{ href: '/employee/rooms', label: 'Salles', icon: Building2 }
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(app-pages)/employee/rooms/page.tsx
git commit -m "feat(rooms): add employee rooms status page"
```

---

## Self-Review

| Spec requirement | Covered |
|---|---|
| Admin creates/renames rooms, sets capacity | ✅ Task 4 (CreateRoomDialog, EditRoomDialog) |
| Admin sets room status (open/closed/reserved) + status_note | ✅ Task 2 setRoomStatusAction, Task 4 SetRoomStatusDialog |
| Employee can set room status | ✅ Task 2 uses `employeeActionClient`; Task 5 employee page |
| Admin can delete rooms | ✅ Task 4 DeleteRoomButton + Task 2 deleteRoomAction |
| Link to seat map editor from rooms list | ✅ Task 4 Step 6 — Map icon links to `/admin/rooms/[roomId]/editor` |
| French UI | ✅ All labels, toasts, errors in French |
| Zod validation | ✅ Task 1 — all 4 schemas |
| `revalidatePath` after mutations | ✅ Task 2 — all actions revalidate relevant paths |
