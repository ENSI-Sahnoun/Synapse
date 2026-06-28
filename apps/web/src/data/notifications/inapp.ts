'use server'

import { createAdminClient } from '@/supabase-clients/server'

export type NotificationType =
  | 'expiry_7d'
  | 'expiry_3d'
  | 'expiry_1d'
  | 'expired'
  | 'renewal_reminder'

export interface InsertInAppNotificationOpts {
  userId: string
  type: NotificationType
  message: string
}

export async function insertInAppNotification({
  userId,
  type,
  message,
}: InsertInAppNotificationOpts): Promise<void> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from as any)('notifications').insert({
    user_id: userId,
    type,
    message,
  })
}

export interface ExpiryWarningOpts {
  studentName: string
  planName: string
  daysRemaining: number
}

export function buildExpiryWarningMessage({
  studentName,
  planName,
  daysRemaining,
}: ExpiryWarningOpts): string {
  return `Bonjour ${studentName}, votre abonnement "${planName}" expire dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}. Pensez à le renouveler pour continuer à profiter de nos services.`
}

export interface ExpiredOpts {
  studentName: string
  planName: string
}

export function buildExpiredMessage({ studentName, planName }: ExpiredOpts): string {
  return `Bonjour ${studentName}, votre abonnement "${planName}" a expiré. Veuillez contacter l'administration pour le renouveler.`
}

export interface RenewalReminderOpts {
  studentName: string
  planName: string
}

export function buildRenewalReminderMessage({
  studentName,
  planName,
}: RenewalReminderOpts): string {
  return `Bonjour ${studentName}, nous vous rappelons que votre abonnement "${planName}" est expiré depuis quelques jours. N'hésitez pas à nous contacter pour le renouveler.`
}
