import twilio from 'twilio'

let _client: ReturnType<typeof twilio> | null = null

function getTwilioClient() {
  if (!_client) {
    _client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!,
    )
  }
  return _client
}

export interface SmsPayload {
  to: string    // Tunisian number, e.g. +21620000000
  body: string  // max 160 chars for single segment
}

export async function sendSms(payload: SmsPayload): Promise<void> {
  const client = getTwilioClient()
  await client.messages.create({
    from: process.env.TWILIO_FROM_NUMBER!,
    to: payload.to,
    body: payload.body,
  })
  // twilio SDK throws on error — no manual error check needed
}

// Template helpers

export function buildExpiredSms(opts: { studentName: string; expiryDate: string }): SmsPayload {
  return {
    to: '',  // caller sets this
    body: `Synapse: Bonjour ${opts.studentName}, votre abonnement a expiré le ${opts.expiryDate}. Passez nous voir pour le renouveler.`,
  }
}

export function buildExpiryWarningSms(opts: {
  studentName: string
  expiryDate: string
  daysLeft: number
}): SmsPayload {
  return {
    to: '',
    body: `Synapse: Bonjour ${opts.studentName}, votre abonnement expire le ${opts.expiryDate} (dans ${opts.daysLeft}j). Pensez à le renouveler.`,
  }
}
