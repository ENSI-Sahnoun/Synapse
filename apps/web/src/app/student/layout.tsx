import { createSupabaseClient } from '@/supabase-clients/server'
import { getCachedLoggedInUserIdOrNull } from '@/rsc-data/supabase'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { StudentBottomNav } from '@/components/student/StudentBottomNav'
import { getMyNotifications, getMyUnreadCount } from '@/data/notifications/list'
import { StudentNotificationSheet } from '@/components/notifications/StudentNotificationSheet'
import { PullToRefresh } from '@/components/PullToRefresh'
import { SecureAccountBanner } from '@/components/student/SecureAccountBanner'
import { RoutePrefetcher } from '@/components/RoutePrefetcher'

const STUDENT_ROUTES = [
  '/student/dashboard',
  '/student/qr',
  '/student/reservation',
  '/student/rooms',
  '/student/history',
  '/student/loyalty',
  '/student/rewards',
  '/student/settings',
]

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCachedLoggedInUserIdOrNull()
  if (!userId) redirect('/login')

  const supabase = await createSupabaseClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, credentials_set')
    .eq('id', userId)
    .single()

  if (profile?.role !== 'student') redirect('/login')

  let notifications: Awaited<ReturnType<typeof getMyNotifications>> = []
  let unreadCount = 0
  try {
    ;[notifications, unreadCount] = await Promise.all([getMyNotifications(20), getMyUnreadCount()])
  } catch {
    // non-fatal
  }

  const initials = profile.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?'

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
      <RoutePrefetcher routes={STUDENT_ROUTES} />
      {/* Top bar */}
      <header
        className="shrink-0 flex items-center justify-between px-4 border-b"
        style={{
          height: '56px',
          backgroundColor: 'var(--surface, #fff)',
          borderColor: 'var(--border)',
        }}
      >
        <Link href="/student/dashboard" aria-label="Synapse — accueil" className="flex items-center">
          <Image
            src="/logos/synapse-logo-nobg.png"
            alt="Synapse"
            width={36}
            height={36}
            priority
          />
        </Link>

        <div className="flex items-center gap-3">
          {/* Notification bell */}
          <StudentNotificationSheet
            initialNotifications={notifications}
            initialUnreadCount={unreadCount}
          />

          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
            style={{ backgroundColor: 'var(--synapse-brown-100)', color: 'var(--accent-brand)' }}
          >
            {initials}
          </div>
        </div>
      </header>

      {!profile.credentials_set && <SecureAccountBanner />}

      {/* Page content */}
      <main className="flex-1 px-4 pt-4 pb-24">
        <PullToRefresh>{children}</PullToRefresh>
      </main>

      <StudentBottomNav />
    </div>
  )
}
