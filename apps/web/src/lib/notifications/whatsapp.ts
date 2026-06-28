export interface WhatsAppTextPayload {
  to: string    // +216xxxxxxxx
  body: string
}

const GRAPH_API_URL = 'https://graph.facebook.com/v19.0'

export async function sendWhatsApp(payload: WhatsAppTextPayload): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!
  const token = process.env.WHATSAPP_API_TOKEN!

  const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: payload.to,
      type: 'text',
      text: { body: payload.body },
    }),
  })

  const json = await response.json() as { error?: { message: string; code: number } }
  if (!response.ok || json.error) {
    throw new Error(`WhatsApp API error ${response.status}: ${json.error?.message ?? JSON.stringify(json)}`)
  }
}

// Template helpers

export function buildExpiryWarningWhatsApp(opts: {
  studentName: string
  planName: string
  expiryDate: string
  daysLeft: number
}): WhatsAppTextPayload {
  return {
    to: '',
    body: `🎓 *Synapse Sfax*\n\nBonjour ${opts.studentName} !\n\nVotre abonnement *${opts.planName}* expire le *${opts.expiryDate}* (dans ${opts.daysLeft} jour(s)).\n\nPassez nous voir pour le renouveler. À bientôt !`,
  }
}

export function buildExpiredWhatsApp(opts: {
  studentName: string
  planName: string
  expiryDate: string
}): WhatsAppTextPayload {
  return {
    to: '',
    body: `🎓 *Synapse Sfax*\n\nBonjour ${opts.studentName},\n\nVotre abonnement *${opts.planName}* a expiré le *${opts.expiryDate}*.\n\nN'hésitez pas à revenir pour le renouveler. Nous vous attendons !`,
  }
}

export function buildRenewalReminderWhatsApp(opts: {
  studentName: string
  planName: string
  expiryDate: string
  daysSinceExpiry: number
}): WhatsAppTextPayload {
  return {
    to: '',
    body: `🎓 *Synapse Sfax*\n\nBonjour ${opts.studentName},\n\nCela fait ${opts.daysSinceExpiry} jour(s) que votre abonnement *${opts.planName}* a expiré (le ${opts.expiryDate}).\n\nRevenez nous voir — votre place vous attend ! 📚`,
  }
}
