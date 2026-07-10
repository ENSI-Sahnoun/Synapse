import { z } from 'zod'

export const assignLockerSchema = z.object({
  locker_id: z.string().uuid('Casier invalide'),
  student_id: z.string().uuid('Étudiant invalide'),
})
export type AssignLockerInput = z.infer<typeof assignLockerSchema>

export const lockerIdSchema = z.object({
  locker_id: z.string().uuid('Casier invalide'),
})
export type LockerIdInput = z.infer<typeof lockerIdSchema>
