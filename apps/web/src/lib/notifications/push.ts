import 'server-only'
import webpush from 'web-push'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'

const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivate = process.env.VAPID_PRIVATE_KEY

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:contact@synapse.tn',
    vapidPublic,
    vapidPrivate,
  )
}

export interface PushPayload {
  title: string
  body: string
  url?: string
}

// ponytail: fire-and-forget browser push, best-effort. Never throws — a push
// failure must not block the in-app notification insert it rides along with.
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (!vapidPublic || !vapidPrivate || userIds.length === 0) return

  const supabase = createSupabaseAdminClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds)
  if (!subs?.length) return

  const body = JSON.stringify(payload)
  const staleIds: string[] = []

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        )
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) staleIds.push(sub.id)
        else console.error('[push] send failed:', err)
      }
    }),
  )

  if (staleIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds)
  }
}
