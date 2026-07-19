import { z } from 'zod'

export const CONTACT_TYPES = ['freelance', 'entreprise', 'autre'] as const
export type ContactType = (typeof CONTACT_TYPES)[number]

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  freelance: 'Freelance / indépendant',
  entreprise: 'Entreprise / équipe',
  autre: 'Autre',
}

export const contactMessageSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Indiquez votre nom')
    .max(100, 'Nom trop long'),
  email: z
    .string()
    .trim()
    .email('Adresse e-mail invalide')
    .max(200, 'Adresse trop longue'),
  phone: z
    .string()
    .trim()
    .max(40, 'Numéro trop long')
    .optional()
    .or(z.literal('')),
  type: z.enum(CONTACT_TYPES, { error: 'Sélectionnez un profil' }),
  message: z
    .string()
    .trim()
    .min(10, 'Votre message est un peu court')
    .max(3000, 'Message trop long'),
  // Honeypot: a hidden field real users never fill. Bots do. Checked server-side.
  company: z.string().max(200).optional(),
})

export type ContactMessageInput = z.infer<typeof contactMessageSchema>
