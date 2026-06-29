import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { signOutAction } from '@/data/auth/sign-out'

export const dynamic = 'force-dynamic'

export default async function EmployeeProfilePage() {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, phone, created_at')
    .eq('id', user.id)
    .single()

  const initials = (profile?.full_name ?? '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const roleLabel = profile?.role === 'admin' ? 'Administrateur' : 'Employé'
  const joinDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
    : '—'

  return (
    <div className="p-4 pb-24" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>Mon profil</h1>

      <div style={{
        background: '#fff', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)', padding: 20,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        textAlign: 'center',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'var(--accent-brand)', color: '#fff',
          fontSize: 26, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {initials}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{profile?.full_name ?? '—'}</div>
          <span style={{
            fontSize: 12, fontWeight: 600, color: 'var(--accent-brand)',
            background: 'rgba(162,114,74,0.1)', borderRadius: 99,
            padding: '2px 10px', display: 'inline-block', marginTop: 6,
          }}>{roleLabel}</span>
        </div>
      </div>

      <div style={{
        background: '#fff', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      }}>
        {[
          { label: 'Email', value: user.email ?? '—' },
          { label: 'Téléphone', value: profile?.phone ?? '—' },
          { label: 'Rôle', value: roleLabel },
          { label: 'Membre depuis', value: joinDate },
        ].map((row, i, arr) => (
          <div key={row.label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px',
            borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{row.label}</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{row.value}</span>
          </div>
        ))}
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
