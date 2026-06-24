import { z } from 'zod'

export const createStudentSchema = z.object({
  full_name: z.string().min(2, 'Nom requis (min 2 caractères)'),
  phone: z.string().min(8, 'Téléphone requis').optional().or(z.literal('')),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  university: z.string().optional().or(z.literal('')),
  study_level: z.string().optional().or(z.literal('')),
})

export type CreateStudentInput = z.infer<typeof createStudentSchema>

export const updateStudentSchema = createStudentSchema.partial().extend({
  id: z.string().uuid(),
})

export type UpdateStudentInput = z.infer<typeof updateStudentSchema>
