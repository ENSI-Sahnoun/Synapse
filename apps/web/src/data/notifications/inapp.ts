import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { sendPushToUsers } from '@/lib/notifications/push'
import type { NotificationType } from '@/lib/notification-types'

/**
 * Whether in-app delivery is enabled for a notification type. Reuses the same
 * `notification_channel_config` table the admin settings page uses for
 * email/SMS/WhatsApp — a missing row means "never explicitly configured",
 * which defaults to enabled so existing behavior doesn't change until an
 * admin flips a type off.
 */
export async function isInAppNotificationEnabled(type: NotificationType): Promise<boolean> {
  const supabase = createSupabaseAdminClient()
  const { data } = await supabase
    .from('notification_channel_config')
    .select('is_enabled')
    .eq('notification_type', type)
    .eq('channel', 'inapp')
    .maybeSingle()
  return data?.is_enabled ?? true
}

export async function notifyAllStaff(
  type: NotificationType,
  message: string,
  opts?: { link?: string },
): Promise<void> {
  if (!(await isInAppNotificationEnabled(type))) return
  const supabase = createSupabaseAdminClient()
  const { data: staff } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['admin', 'employee'])
  if (!staff?.length) return
  await supabase.from('notifications').insert(
    staff.map((p) => ({ user_id: p.id, type, message, link: opts?.link ?? null })),
  )
  await sendPushToUsers(staff.map((p) => p.id), { title: 'Synapse', body: message })
}

export async function notifyAllUsers(
  type: NotificationType,
  message: string,
  opts?: { important?: boolean; onlyUserId?: string },
): Promise<void> {
  if (!(await isInAppNotificationEnabled(type))) return
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

/**
 * Staff broadcasts insert one row per staff member (see notifyAllStaff), so
 * marking one recipient's copy read (e.g. by acting on the request) leaves
 * every other admin/employee's copy unread forever. Call this when a request
 * is resolved to close out every staff copy sharing the same deep link.
 */
export async function resolveStaffNotificationsByLink(link: string): Promise<void> {
  const supabase = createSupabaseAdminClient()
  await supabase.from('notifications').update({ is_read: true }).eq('link', link).eq('is_read', false)
}

export interface InsertInAppNotificationOpts {
  userId: string
  type: NotificationType
  message: string
  link?: string
}

export async function insertInAppNotification({
  userId,
  type,
  message,
  link,
}: InsertInAppNotificationOpts): Promise<void> {
  if (!(await isInAppNotificationEnabled(type))) return
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    message,
    link: link ?? null,
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
