import { z } from 'zod'

export const createRoomSchema = z.object({
  name: z.string().min(1, 'Nom de la salle requis'),
  capacity: z
    .number({ message: 'La capacité doit être un nombre' })
    .int('La capacité doit être un entier')
    .min(1, 'La capacité doit être au moins 1'),
})

export type CreateRoomInput = z.infer<typeof createRoomSchema>

export const updateRoomSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Nom de la salle requis').optional(),
  capacity: z
    .number({ message: 'La capacité doit être un nombre' })
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
