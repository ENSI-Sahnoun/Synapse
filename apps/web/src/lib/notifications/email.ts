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
  replyTo?: string    // where a human reply should go (e.g. a contact-form sender)
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const { error } = await getResend().emails.send({
    from: 'Synapse <notifications@synapse-sfax.tn>',
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Contact-form message → email sent to the Synapse inbox. `replyTo` is set to
 * the visitor's address so the team can reply straight from their mailbox.
 */
export function buildContactEmail(opts: {
  inbox: string
  name: string
  email: string
  phone?: string
  typeLabel: string
  message: string
}): EmailPayload {
  const { inbox, name, email, phone, typeLabel, message } = opts
  return {
    to: inbox,
    replyTo: email,
    subject: `Nouveau contact professionnel — ${escapeHtml(name)}`,
    html: `
      <h2 style="margin:0 0 12px;font-family:sans-serif">Nouveau message depuis le site Synapse</h2>
      <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0;color:#665C54">Nom</td><td><strong>${escapeHtml(name)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#665C54">E-mail</td><td>${escapeHtml(email)}</td></tr>
        ${phone ? `<tr><td style="padding:4px 12px 4px 0;color:#665C54">Téléphone</td><td>${escapeHtml(phone)}</td></tr>` : ''}
        <tr><td style="padding:4px 12px 4px 0;color:#665C54">Profil</td><td>${escapeHtml(typeLabel)}</td></tr>
      </table>
      <p style="font-family:sans-serif;font-size:14px;color:#665C54;margin:16px 0 4px">Message</p>
      <p style="font-family:sans-serif;font-size:15px;line-height:1.6;white-space:pre-wrap">${escapeHtml(message)}</p>
    `,
  }
}
