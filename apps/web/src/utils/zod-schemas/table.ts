import { z } from 'zod'
import { seatUpsertItemSchema } from './seat'

export const tableUpsertItemSchema = z.object({
  id: z.string().uuid(),
  room_id: z.string().uuid(),
  label: z.string().max(20, { message: 'Max 20 caractères' }),
  position_x: z.number(),
  position_y: z.number(),
  width: z.number().min(10, { message: 'Largeur min 10px' }),
  height: z.number().min(10, { message: 'Hauteur min 10px' }),
  rotation: z.number().int().min(0).max(345),
})

export type TableUpsertItem = z.infer<typeof tableUpsertItemSchema>

export const deleteTableSchema = z.object({
  id: z.string().uuid(),
  room_id: z.string().uuid(),
  // Required to delete a table whose chairs are occupied or reserved.
  force: z.boolean().optional().default(false),
})

export type DeleteTableInput = z.infer<typeof deleteTableSchema>

export const upsertSeatMapSchema = z.object({
  room_id: z.string().uuid(),
  tables: z.array(tableUpsertItemSchema),
  seats: z.array(seatUpsertItemSchema),
})

export type UpsertSeatMapInput = z.infer<typeof upsertSeatMapSchema>
