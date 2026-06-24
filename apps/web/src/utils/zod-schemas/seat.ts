import { z } from 'zod'

export const seatUpsertItemSchema = z.object({
  id: z.string().uuid().optional(),
  room_id: z.string().uuid(),
  label: z.string().min(1, { message: 'Étiquette requise' }).max(10, { message: 'Max 10 caractères' }),
  position_x: z.number(),
  position_y: z.number(),
  status: z.enum(['free', 'occupied', 'reserved', 'out_of_service']),
})

export type SeatUpsertItem = z.infer<typeof seatUpsertItemSchema>

export const upsertSeatsSchema = z.object({
  room_id: z.string().uuid(),
  seats: z.array(seatUpsertItemSchema).min(1, { message: 'Au moins une place requise' }),
})

export type UpsertSeatsInput = z.infer<typeof upsertSeatsSchema>

export const deleteSeatSchema = z.object({
  id: z.string().uuid(),
  room_id: z.string().uuid(),
})

export type DeleteSeatInput = z.infer<typeof deleteSeatSchema>
