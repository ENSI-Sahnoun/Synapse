import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { sendPushToUsers } from '@/lib/notifications/push'
import type { NotificationType } from '@/lib/notification-types'

export async function notifyAllStaff(type: NotificationType, message: string): Promise<void> {
  const supabase = createSupabaseAdminClient()
  const { data: staff } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['admin', 'employee'])
  if (!staff?.length) return
  await supabase.from('notifications').insert(
    staff.map((p) => ({ user_id: p.id, type, message })),
  )
  await sendPushToUsers(staff.map((p) => p.id), { title: 'Synapse', body: message })
}

export async function notifyAllUsers(
  type: NotificationType,
  message: string,
  opts?: { important?: boolean; onlyUserId?: string },
): Promise<void> {
  const supabase = createSupabaseAdminClient()
  let query = supabase.from('profiles').select('id')
  if (opts?.onlyUserId) query = query.eq('id', opts.onlyUserId)
  const { data: users } = await query
  if (!users?.length) return
  const isImportant = opts?.important ?? false
  const importantUntil = isImportant ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null
  await supabase.from('notifications').insert(
    users.map((p) => ({
      user_id: p.id,
      type,
      message,
      is_important: isImportant,
      important_until: importantUntil,
    })),
  )
  await sendPushToUsers(users.map((p) => p.id), { title: 'Synapse', body: message })
}

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
  await sendPushToUsers([userId], { title: 'Synapse', body: message })
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
