import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { getCachedLoggedInUserIdOrNull } from '@/rsc-data/supabase'
import { AnnouncementsClient } from './AnnouncementsClient'
import { LiveRefresher } from '@/components/live/LiveRefresher'

export const dynamic = 'force-dynamic'

export default async function AnnouncementsPage() {
  const supabase = await createSupabaseClient()
  const userId = await getCachedLoggedInUserIdOrNull()
  if (!userId) redirect('/login')

  const { data: announcements } = await (supabase.from('announcements' as never) as ReturnType<typeof supabase.from>)
    .select('id, title, body, pinned, created_at, created_by, recipient_id')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false }) as { data: {
      id: string; title: string; body: string; pinned: boolean;
      created_at: string; created_by: string | null; recipient_id: string | null;
    }[] | null }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .order('full_name', { ascending: true })

  const announcementIds = (announcements ?? []).map((a) => a.id)
  const readStats: Record<string, { total: number; read: number }> = {}
  if (announcementIds.length) {
    const { data: notifs } = await (supabase.from('notifications' as never) as ReturnType<typeof supabase.from>)
      .select('announcement_id, is_read')
      .in('announcement_id', announcementIds) as { data: { announcement_id: string; is_read: boolean }[] | null }
    for (const n of notifs ?? []) {
      const stat = readStats[n.announcement_id] ?? { total: 0, read: 0 }
      stat.total += 1
      if (n.is_read) stat.read += 1
      readStats[n.announcement_id] = stat
    }
  }

  return (
    <div className="p-4 pb-24">
      <LiveRefresher tables={['announcements']} />
      <AnnouncementsClient
        announcements={announcements ?? []}
        currentUserId={userId}
        recipients={(profiles ?? []) as { id: string; full_name: string | null }[]}
        readStats={readStats}
      />
    </div>
  )
}
