import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { getCachedLoggedInUserClaims } from '@/rsc-data/supabase'
import { signOutAction } from '@/data/auth/sign-out'
import { ProfileForm } from '@/components/user/ProfileForm'

export const dynamic = 'force-dynamic'

export default async function EmployeeProfilePage() {
  const supabase = await createSupabaseClient()
  const claims = await getCachedLoggedInUserClaims().catch(() => null)
  if (!claims?.sub) redirect('/login')
  const user = { id: claims.sub as string, email: claims.email as string | undefined }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, phone, created_at, avatar_url')
    .eq('id', user.id)
    .single()

  const roleLabel = profile?.role === 'admin' ? 'Administrateur' : 'Employé'
  const joinDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
    : '—'

  return (
    <div className="p-4 pb-24" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>Mon profil</h1>

      <div style={{
        background: '#fff', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)', padding: 20,
      }}>
        <ProfileForm
          userId={user.id}
          fullName={profile?.full_name ?? ''}
          phone={profile?.phone ?? null}
          avatarUrl={profile?.avatar_url ?? null}
          roleLabel={roleLabel}
        />
      </div>

      <div style={{
        background: '#fff', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px',
      }}>
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Membre depuis</span>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{joinDate}</span>
      </div>

      <form action={signOutAction}>
        <button type="submit" style={{
          width: '100%', padding: '13px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-default)',
          background: 'transparent',
          fontSize: 14, fontWeight: 600,
          color: 'var(--muted-foreground)', cursor: 'pointer',
        }}>
          Déconnexion
        </button>
      </form>
    </div>
  )
}
