import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { Bell } from '@phosphor-icons/react/dist/ssr'
import { StudentBottomNav } from '@/components/student/StudentBottomNav'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'student') redirect('/login')

  const initials = profile.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?'

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
      {/* Top bar */}
      <header
        className="shrink-0 flex items-center justify-between px-4 border-b"
        style={{
          height: '56px',
          backgroundColor: 'var(--surface, #fff)',
          borderColor: 'var(--border)',
        }}
      >
        <span
          className="text-base tracking-tight"
          style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--foreground)' }}
        >
          Synapse
        </span>

        <div className="flex items-center gap-3">
          {/* Notification bell — slot for Phase 6 */}
          <button
            type="button"
            className="cursor-pointer transition-colors duration-150"
            aria-label="Notifications"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <Bell size={20} weight="regular" />
          </button>

          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
            style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
          >
            {initials}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 px-4 pt-4 pb-24">
        {children}
      </main>

      <StudentBottomNav />
    </div>
  )
}
