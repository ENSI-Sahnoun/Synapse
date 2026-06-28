import { sendEmail } from './email'
import { sendSms } from './sms'
import { sendWhatsApp } from './whatsapp'
import type { NotificationChannel } from '@/lib/notification-types'

export interface DispatchTarget {
  email?: string
  phone?: string // +216xxxxxxxx format
}

export interface DispatchMessage {
  emailSubject: string
  emailHtml: string
  smsBody: string
  whatsappBody: string
}

/**
 * Dispatches a notification to all specified channels.
 * Errors per channel are caught and collected — a failed SMS does not block WhatsApp.
 */
export async function dispatch(
  channels: NotificationChannel[],
  target: DispatchTarget,
  message: DispatchMessage,
): Promise<{ channel: NotificationChannel; error: string | null }[]> {
  const results: { channel: NotificationChannel; error: string | null }[] = []

  for (const channel of channels) {
    try {
      if (channel === 'email') {
        if (!target.email) throw new Error('No email address for target')
        await sendEmail({
          to: target.email,
          subject: message.emailSubject,
          html: message.emailHtml,
        })
      } else if (channel === 'sms') {
        if (!target.phone) throw new Error('No phone number for target')
        await sendSms({ to: target.phone, body: message.smsBody })
      } else if (channel === 'whatsapp') {
        if (!target.phone) throw new Error('No phone number for target')
        await sendWhatsApp({ to: target.phone, body: message.whatsappBody })
      }
      // 'inapp' is a no-op here — in-app notifications are written to the DB by the scheduled processor directly
      results.push({ channel, error: null })
    } catch (err) {
      results.push({
        channel,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return results
}
