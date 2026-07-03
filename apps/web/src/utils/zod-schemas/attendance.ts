import { z } from 'zod'

export const assignSeatSchema = z.object({
  student_id: z.string().uuid().nullable().optional(),
  seat_id: z.string().uuid(),
  room_id: z.string().uuid(),
})

export type AssignSeatInput = z.infer<typeof assignSeatSchema>
