import { z } from 'zod'

export const createRoomSchema = z.object({
  name: z.string().min(1, 'Nom de la salle requis'),
})

export type CreateRoomInput = z.infer<typeof createRoomSchema>

export const updateRoomSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Nom de la salle requis').optional(),
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

export const updateRoomShapesSchema = z.object({
  rooms: z
    .array(
      z.object({
        id: z.string().uuid(),
        shape_x: z.number(),
        shape_y: z.number(),
        shape_width: z.number().positive(),
        shape_height: z.number().positive(),
      }),
    )
    .min(1, 'Au moins une salle requise'),
})

export type UpdateRoomShapesInput = z.infer<typeof updateRoomShapesSchema>
