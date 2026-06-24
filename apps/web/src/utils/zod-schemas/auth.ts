import { z } from 'zod'

export const studentSignupSchema = z.object({
  full_name: z.string().min(2, 'Nom requis (min 2 caractères)'),
  email: z.string().email('Email invalide'),
  phone: z.string().min(8, 'Téléphone requis (min 8 chiffres)').optional().or(z.literal('')),
  university: z.string().optional().or(z.literal('')),
  study_level: z.string().optional().or(z.literal('')),
  password: z.string().min(8, 'Mot de passe minimum 8 caractères'),
  password_confirm: z.string(),
}).refine((data) => data.password === data.password_confirm, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['password_confirm'],
})

export type StudentSignupInput = z.infer<typeof studentSignupSchema>
