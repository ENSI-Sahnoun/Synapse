'use server'

import { actionClient } from '@/lib/safe-action'
import { buildContactEmail, sendEmail } from '@/lib/notifications/email'
import {
  CONTACT_TYPE_LABELS,
  contactMessageSchema,
} from '@/utils/zod-schemas/contact'

/**
 * Public contact-form submission (no auth). Sends the message to the Synapse
 * inbox via Resend, with the sender's address as reply-to. A filled honeypot
 * is silently dropped as a success so bots get no signal.
 */
export const sendContactMessage = actionClient
  .schema(contactMessageSchema)
  .action(async ({ parsedInput }) => {
    if (parsedInput.company && parsedInput.company.trim() !== '') {
      return { success: true }
    }

    const inbox = process.env.CONTACT_INBOX_EMAIL || 'contact@synapse-sfax.tn'

    await sendEmail(
      buildContactEmail({
        inbox,
        name: parsedInput.name,
        email: parsedInput.email,
        phone: parsedInput.phone || undefined,
        typeLabel: CONTACT_TYPE_LABELS[parsedInput.type],
        message: parsedInput.message,
      }),
    )

    return { success: true }
  })
