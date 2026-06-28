import { NextRequest, NextResponse } from 'next/server'
import { getSubscriptionsByExpiryOffset } from '@/data/notifications/expiry-queries'
import { getEnabledChannels, type NotificationType } from '@/data/admin/notification-channel-config'
import { dispatch } from '@/lib/notifications/dispatcher'
import {
  insertInAppNotification,
  buildExpiryWarningMessage,
  buildExpiredMessage,
  buildRenewalReminderMessage,
} from '@/data/notifications/inapp'
import {
  buildExpiryWarningEmail,
  buildExpiredEmail,
  buildRenewalReminderEmail,
} from '@/lib/notifications/email'
import { buildExpiryWarningSms, buildExpiredSms } from '@/lib/notifications/sms'
import {
  buildExpiryWarningWhatsApp,
  buildExpiredWhatsApp,
  buildRenewalReminderWhatsApp,
} from '@/lib/notifications/whatsapp'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

function formatDate(isoDate: string): string {
  return format(new Date(isoDate), 'dd/MM/yyyy', { locale: fr })
}

interface TriggerConfig {
  daysOffset: number
  notificationType: NotificationType
}

const TRIGGERS: TriggerConfig[] = [
  { daysOffset: 7, notificationType: 'expiry_7d' },
  { daysOffset: 3, notificationType: 'expiry_3d' },
  { daysOffset: 1, notificationType: 'expiry_1d' },
  { daysOffset: 0, notificationType: 'expired' },
  { daysOffset: -3, notificationType: 'renewal_reminder' },
]

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify cron secret
  const secret = request.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const report: Record<string, { processed: number; errors: string[] }> = {}

  for (const trigger of TRIGGERS) {
    const { daysOffset, notificationType } = trigger
    report[notificationType] = { processed: 0, errors: [] }

    try {
      const students = await getSubscriptionsByExpiryOffset(daysOffset)
      const channels = await getEnabledChannels(notificationType)

      for (const student of students) {
        try {
          const formattedDate = formatDate(student.end_date)

          // Build messages
          let emailSubject = ''
          let emailHtml = ''
          let smsBody = ''
          let whatsappBody = ''
          let inAppMessage = ''

          if (notificationType === 'expired') {
            const emailMsg = buildExpiredEmail({
              studentName: student.student_name,
              planName: student.plan_name,
              expiryDate: formattedDate,
            })
            emailSubject = emailMsg.subject
            emailHtml = emailMsg.html
            smsBody = buildExpiredSms({
              studentName: student.student_name,
              expiryDate: formattedDate,
            }).body
            whatsappBody = buildExpiredWhatsApp({
              studentName: student.student_name,
              planName: student.plan_name,
              expiryDate: formattedDate,
            }).body
            inAppMessage = buildExpiredMessage({
              planName: student.plan_name,
              expiryDate: formattedDate,
            })
          } else if (notificationType === 'renewal_reminder') {
            const emailMsg = buildRenewalReminderEmail({
              studentName: student.student_name,
              planName: student.plan_name,
              expiryDate: formattedDate,
            })
            emailSubject = emailMsg.subject
            emailHtml = emailMsg.html
            smsBody = buildExpiredSms({
              studentName: student.student_name,
              expiryDate: formattedDate,
            }).body
            whatsappBody = buildRenewalReminderWhatsApp({
              studentName: student.student_name,
              planName: student.plan_name,
              expiryDate: formattedDate,
              daysSinceExpiry: 3,
            }).body
            inAppMessage = buildRenewalReminderMessage({
              planName: student.plan_name,
              expiryDate: formattedDate,
            })
          } else {
            // expiry_7d, expiry_3d, expiry_1d
            const emailMsg = buildExpiryWarningEmail({
              studentName: student.student_name,
              planName: student.plan_name,
              expiryDate: formattedDate,
              daysLeft: daysOffset,
            })
            emailSubject = emailMsg.subject
            emailHtml = emailMsg.html
            smsBody = buildExpiryWarningSms({
              studentName: student.student_name,
              expiryDate: formattedDate,
              daysLeft: daysOffset,
            }).body
            whatsappBody = buildExpiryWarningWhatsApp({
              studentName: student.student_name,
              planName: student.plan_name,
              expiryDate: formattedDate,
              daysLeft: daysOffset,
            }).body
            inAppMessage = buildExpiryWarningMessage({
              planName: student.plan_name,
              daysLeft: daysOffset,
              expiryDate: formattedDate,
            })
          }

          // Always insert in-app notification
          await insertInAppNotification({
            userId: student.student_id,
            type: notificationType,
            message: inAppMessage,
          })

          // Dispatch to external channels
          const externalChannels = channels.filter((c) => c !== 'inapp')
          if (externalChannels.length > 0) {
            const results = await dispatch(
              externalChannels,
              {
                email: student.student_email ?? undefined,
                phone: student.student_phone ?? undefined,
              },
              { emailSubject, emailHtml, smsBody, whatsappBody },
            )
            results.forEach(({ channel, error }) => {
              if (error) {
                report[notificationType].errors.push(
                  `student=${student.student_id} channel=${channel}: ${error}`,
                )
                console.error(
                  `[notifications] ${notificationType} ${channel} failed for ${student.student_id}: ${error}`,
                )
              }
            })
          }

          report[notificationType].processed++
        } catch (studentErr) {
          const msg = studentErr instanceof Error ? studentErr.message : String(studentErr)
          report[notificationType].errors.push(`student=${student.student_id}: ${msg}`)
          console.error(`[notifications] failed for student ${student.student_id}:`, studentErr)
        }
      }
    } catch (triggerErr) {
      const msg = triggerErr instanceof Error ? triggerErr.message : String(triggerErr)
      report[notificationType].errors.push(`trigger_error: ${msg}`)
      console.error(`[notifications] trigger ${notificationType} failed:`, triggerErr)
    }
  }

  return NextResponse.json({ ok: true, report })
}
