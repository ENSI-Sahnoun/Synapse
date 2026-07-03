import { getMyProfile } from '@/data/student/profile'
import { createSupabaseClient } from '@/supabase-clients/server'
import { signOutAction } from '@/data/auth/sign-out'
import { SignOut } from '@phosphor-icons/react/dist/ssr'
import { StudentSettingsClient } from './StudentSettingsClient'

export default async function StudentSettingsPage() {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = await getMyProfile()

  const initials = profile.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?'

  const meta = user?.user_metadata ?? {}

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
        Paramètres
      </h1>

      {/* Profile card */}
      <div
        className="rounded-xl border p-5 flex items-center gap-4"
        style={{ background: 'white', borderColor: 'var(--border-subtle)' }}
      >
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-full text-white font-bold text-lg"
          style={{ width: 52, height: 52, background: 'var(--accent-brand)' }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base truncate">{profile.full_name}</p>
          <p className="text-sm truncate" style={{ color: 'var(--muted-foreground)' }}>
            {user?.email}
          </p>
        </div>
      </div>

      {/* Functional client section: toggles + email/password reset */}
      <StudentSettingsClient
        initialPush={meta.push_enabled !== false}
        initialEmailDigest={meta.email_digest === true}
        currentEmail={user?.email ?? ''}
      />

      {/* Sign out */}
      <form action={signOutAction}>
        <button
          type="submit"
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border"
          style={{ background: '#fee2e2', borderColor: '#fecaca', color: '#dc2626' }}
        >
          <div className="flex-shrink-0 flex items-center justify-center rounded-[10px]" style={{ width: 36, height: 36, background: '#fecaca' }}>
            <SignOut size={17} style={{ color: '#dc2626' }} />
          </div>
          <span className="text-sm font-semibold">Se déconnecter</span>
        </button>
      </form>
    </div>
  )
}
