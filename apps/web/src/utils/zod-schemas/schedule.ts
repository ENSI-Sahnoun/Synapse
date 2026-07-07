import { z } from 'zod'

const timeString = z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM requis')

export const scheduleDaySchema = z
  .object({
    day_of_week: z.number().int().min(0).max(6),
    start_time: timeString.optional().or(z.literal('')),
    end_time: timeString.optional().or(z.literal('')),
  })
  .refine((d) => (d.start_time ? !!d.end_time : !d.end_time), {
    message: 'Heure de début et de fin requises ensemble',
    path: ['end_time'],
  })
  .refine((d) => !d.start_time || !d.end_time || d.end_time > d.start_time, {
    message: 'Heure de fin doit être après le début',
    path: ['end_time'],
  })

export const saveWeeklyScheduleSchema = z.object({
  employee_id: z.string().uuid(),
  role: z.string().min(1, 'Rôle requis').default('Front Desk'),
  days: z.array(scheduleDaySchema).length(7),
})

export type SaveWeeklyScheduleInput = z.infer<typeof saveWeeklyScheduleSchema>
