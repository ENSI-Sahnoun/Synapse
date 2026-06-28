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
