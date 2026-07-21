import { createSupabaseClient } from '@/supabase-clients/server'
import { getCachedLoggedInUserIdOrNull } from '@/rsc-data/supabase'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { StudentBottomNav } from '@/components/student/StudentBottomNav'
import { StudentHeaderMenu } from '@/components/student/StudentHeaderMenu'
import { getMyNotifications, getMyUnreadCount } from '@/data/notifications/list'
import { StudentNotificationSheet } from '@/components/notifications/StudentNotificationSheet'
import { PullToRefresh } from '@/components/PullToRefresh'
import { SecureAccountBanner } from '@/components/student/SecureAccountBanner'
import { RoutePrefetcher } from '@/components/RoutePrefetcher'
import StudentSplash from '@/components/student/StudentSplash'
import { CelebrationPopup } from '@/components/student/CelebrationPopup'

const STUDENT_ROUTES = [
  '/student/dashboard',
  '/student/qr',
  '/student/rooms',
  '/student/history',
  '/student/shop',
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
    .select('role, full_name, credentials_set, avatar_url')
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
      <StudentSplash />
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

          {/* Avatar — opens account menu (name, historique, logout) */}
          <StudentHeaderMenu fullName={profile.full_name} initials={initials} avatarUrl={profile.avatar_url} />
        </div>
      </header>

      {!profile.credentials_set && <SecureAccountBanner />}

      {/* Page content */}
      <main className="flex-1 px-4 pt-4 pb-24">
        <PullToRefresh>{children}</PullToRefresh>
      </main>

      <CelebrationPopup />

      <StudentBottomNav />
    </div>
  )
}
