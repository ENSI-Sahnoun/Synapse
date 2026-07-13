import { z } from 'zod'

export const saveEmployeeAttendanceSchema = z.object({
  id: z.string().uuid().optional(), // omitted -> insert a new row (covers "forgot to clock in entirely")
  employee_id: z.string().uuid(),
  clock_in: z.string().min(1, 'Heure d\'arrivée requise'),
  clock_out: z.string().nullable(),
})

export type SaveEmployeeAttendanceInput = z.infer<typeof saveEmployeeAttendanceSchema>
