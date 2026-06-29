import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { AnnouncementsClient } from './AnnouncementsClient'

export const dynamic = 'force-dynamic'

export default async function AnnouncementsPage() {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: announcements } = await (supabase.from('announcements' as never) as ReturnType<typeof supabase.from>)
    .select('id, title, body, pinned, created_at, created_by')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false }) as { data: {
      id: string; title: string; body: string; pinned: boolean;
      created_at: string; created_by: string | null;
    }[] | null }

  return (
    <div className="p-4 pb-24">
      <AnnouncementsClient announcements={announcements ?? []} currentUserId={user.id} />
    </div>
  )
}
