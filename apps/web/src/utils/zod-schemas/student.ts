import { z } from 'zod'

const studentBaseSchema = z.object({
  full_name: z.string().min(2, 'Nom requis (min 2 caractères)'),
  phone: z.string().min(8, 'Téléphone requis').optional().or(z.literal('')),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  university: z.string().optional().or(z.literal('')),
  study_level: z.string().optional().or(z.literal('')),
})

const requireEmailOrPhone = (
  data: { email?: string; phone?: string },
  ctx: z.RefinementCtx,
) => {
  const hasEmail = !!data.email && data.email.trim() !== ''
  const hasPhone = !!data.phone && data.phone.trim() !== ''
  if (!hasEmail && !hasPhone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Un email ou un numéro de téléphone est requis',
      path: ['email'],
    })
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Un email ou un numéro de téléphone est requis',
      path: ['phone'],
    })
  }
}

export const createStudentSchema = studentBaseSchema.superRefine(requireEmailOrPhone)

export type CreateStudentInput = z.infer<typeof createStudentSchema>

export const updateStudentSchema = studentBaseSchema.partial().extend({
  id: z.string().uuid(),
})

export type UpdateStudentInput = z.infer<typeof updateStudentSchema>
