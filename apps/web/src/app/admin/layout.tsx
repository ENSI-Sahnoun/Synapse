import { createSupabaseClient } from '@/supabase-clients/server'
import { getCachedLoggedInUserIdOrNull } from '@/rsc-data/supabase'
import { redirect } from 'next/navigation'
import { getMyNotifications, getMyUnreadCount } from '@/data/notifications/list'
import { getResolvedNavItems } from '@/data/nav/get-resolved-nav-items'
import { EmployeeMobileShell } from '@/components/employee/EmployeeMobileShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCachedLoggedInUserIdOrNull()
  if (!userId) redirect('/login')

  const supabase = await createSupabaseClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', userId)
    .single()

  if (profile?.role !== 'admin') redirect('/login')

  let notifications: Awaited<ReturnType<typeof getMyNotifications>> = []
  let unreadCount = 0
  try {
    ;[notifications, unreadCount] = await Promise.all([getMyNotifications(20), getMyUnreadCount()])
  } catch {
    // non-fatal — bell renders empty
  }

  const navItems = await getResolvedNavItems(supabase, 'admin')

  return (
    <EmployeeMobileShell
      fullName={profile.full_name ?? ''}
      role={profile.role}
      navItems={navItems}
      initialNotifications={notifications}
      initialUnreadCount={unreadCount}
    >
      {children}
    </EmployeeMobileShell>
  )
}
