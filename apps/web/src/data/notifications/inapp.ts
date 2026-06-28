import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import type { NotificationType } from '@/lib/notification-types'

export type { NotificationType } from '@/lib/notification-types'

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
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    message,
  })
  if (error) throw error
}

export function buildExpiryWarningMessage(opts: {
  planName: string
  daysLeft: number
  expiryDate: string
}): string {
  return `Votre abonnement "${opts.planName}" expire dans ${opts.daysLeft} jour(s) (le ${opts.expiryDate}).`
}

export function buildExpiredMessage(opts: { planName: string; expiryDate: string }): string {
  return `Votre abonnement "${opts.planName}" a expiré le ${opts.expiryDate}. Rendez-vous à Synapse pour le renouveler.`
}

export function buildRenewalReminderMessage(opts: { planName: string; expiryDate: string }): string {
  return `Rappel : votre abonnement "${opts.planName}" a expiré le ${opts.expiryDate}. Revenez nous voir !`
}
