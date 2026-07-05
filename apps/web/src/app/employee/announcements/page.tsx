import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { getCachedLoggedInUserIdOrNull } from '@/rsc-data/supabase'
import { AnnouncementsClient } from './AnnouncementsClient'

export const dynamic = 'force-dynamic'

export default async function AnnouncementsPage() {
  const supabase = await createSupabaseClient()
  const userId = await getCachedLoggedInUserIdOrNull()
  if (!userId) redirect('/login')

  const { data: announcements } = await (supabase.from('announcements' as never) as ReturnType<typeof supabase.from>)
    .select('id, title, body, pinned, created_at, created_by')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false }) as { data: {
      id: string; title: string; body: string; pinned: boolean;
      created_at: string; created_by: string | null;
    }[] | null }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .order('full_name', { ascending: true })

  return (
    <div className="p-4 pb-24">
      <AnnouncementsClient
        announcements={announcements ?? []}
        currentUserId={userId}
        recipients={(profiles ?? []) as { id: string; full_name: string | null }[]}
      />
    </div>
  )
}
