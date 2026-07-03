import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { getMyNotifications, getMyUnreadCount } from '@/data/notifications/list'
import { EmployeeMobileShell } from '@/components/employee/EmployeeMobileShell'

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'employee'].includes(profile.role)) redirect('/login')

  let notifications: Awaited<ReturnType<typeof getMyNotifications>> = []
  let unreadCount = 0
  try {
    ;[notifications, unreadCount] = await Promise.all([getMyNotifications(20), getMyUnreadCount()])
  } catch {
    // non-fatal
  }

  return (
    <EmployeeMobileShell
      fullName={profile.full_name ?? ''}
      role={profile.role}
      initialNotifications={notifications}
      initialUnreadCount={unreadCount}
    >
      {children}
    </EmployeeMobileShell>
  )
}
