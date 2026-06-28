import { Resend } from 'resend'

let resend: Resend | null = null

function getResend(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

export interface EmailPayload {
  to: string          // student email
  subject: string
  html: string
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const { error } = await getResend().emails.send({
    from: 'Synapse <notifications@synapse-sfax.tn>',
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  })

  if (error) {
    throw new Error(`Resend delivery failed: ${error.message}`)
  }
}

// Template helpers

export function buildExpiryWarningEmail(opts: {
  studentName: string
  planName: string
  expiryDate: string   // formatted dd/MM/yyyy
  daysLeft: number
}): EmailPayload {
  const { studentName, planName, expiryDate, daysLeft } = opts
  return {
    to: '',  // caller sets this
    subject: `Votre abonnement Synapse expire dans ${daysLeft} jour(s)`,
    html: `
      <p>Bonjour ${studentName},</p>
      <p>Votre abonnement <strong>${planName}</strong> expire le <strong>${expiryDate}</strong> (dans ${daysLeft} jour(s)).</p>
      <p>Rendez-vous à Synapse pour le renouveler.</p>
      <p>— L'équipe Synapse, Sfax</p>
    `,
  }
}

export function buildExpiredEmail(opts: {
  studentName: string
  planName: string
  expiryDate: string
}): EmailPayload {
  const { studentName, planName, expiryDate } = opts
  return {
    to: '',
    subject: 'Votre abonnement Synapse est expiré',
    html: `
      <p>Bonjour ${studentName},</p>
      <p>Votre abonnement <strong>${planName}</strong> a expiré le <strong>${expiryDate}</strong>.</p>
      <p>Revenez nous voir pour le renouveler et retrouver votre place à Synapse !</p>
      <p>— L'équipe Synapse, Sfax</p>
    `,
  }
}

export function buildRenewalReminderEmail(opts: {
  studentName: string
  planName: string
  expiryDate: string
}): EmailPayload {
  const { studentName, planName, expiryDate } = opts
  return {
    to: '',
    subject: 'Rappel de renouvellement — Synapse',
    html: `
      <p>Bonjour ${studentName},</p>
      <p>Votre abonnement <strong>${planName}</strong> a expiré le <strong>${expiryDate}</strong>.</p>
      <p>Il n'est pas trop tard pour revenir — revenez nous voir pour vous réinscrire.</p>
      <p>— L'équipe Synapse, Sfax</p>
    `,
  }
}
