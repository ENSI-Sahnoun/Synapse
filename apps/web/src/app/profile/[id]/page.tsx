import { getCachedLoggedInUserClaims } from '@/rsc-data/supabase'
import { getProfileById, getAchievementsForStudent, getLoyaltyBalanceForStudent } from '@/data/user/profile'
import { getLevelsForStudents } from '@/data/student/achievements'
import { redirect } from 'next/navigation'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { BackButton } from '@/components/user/BackButton'
import { AchievementRoadmap } from '@/components/student/AchievementRoadmap'

export const dynamic = 'force-dynamic'

const roleLabels: Record<string, string> = {
  student: 'Étudiant',
  employee: 'Employé',
  admin: 'Administrateur',
  kiosk: 'Kiosk',
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const claims = await getCachedLoggedInUserClaims()
  if (!claims || !claims.sub) {
    redirect('/login')
  }

  const { id } = await params
  const profile = await getProfileById(id)

  const isStudent = profile.role === 'student'
  const [achievements, points] = isStudent
    ? await Promise.all([getAchievementsForStudent(id), getLoyaltyBalanceForStudent(id)])
    : [[], 0]

  const levels = isStudent ? await getLevelsForStudents([id]) : []
  const unlockedCount = achievements.filter((a) => a.unlocked).length

  const initials = profile.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?'

  const roleLabel = roleLabels[profile.role] ?? profile.role

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-sm mx-auto px-4 pt-4 pb-8 space-y-4">
        <BackButton />

        {/* Identity card */}
        <div
          className="rounded-2xl border p-6 space-y-4"
          style={{ background: 'var(--surface)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex justify-center">
            <Avatar className="h-20 w-20 ring-4" style={{ boxShadow: '0 0 0 4px var(--synapse-cream-200)' }}>
              {profile.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? 'User'} />
              )}
              <AvatarFallback
                className="text-lg font-bold text-white"
                style={{ background: 'var(--accent-brand)' }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="text-center">
            <p className="font-bold text-lg">{profile.full_name}</p>
          </div>

          <div className="flex justify-center flex-wrap gap-2">
            <Badge variant="secondary">{roleLabel}</Badge>
            {profile.level != null && <Badge variant="secondary">Niveau {profile.level}</Badge>}
          </div>

          {isStudent && (profile.university || profile.study_level) && (
            <div className="grid grid-cols-2 gap-3 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
              {profile.university && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    Université
                  </p>
                  <p className="text-sm mt-0.5">{profile.university}</p>
                </div>
              )}
              {profile.study_level && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    Niveau d&apos;études
                  </p>
                  <p className="text-sm mt-0.5">{profile.study_level}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {isStudent && (
          <>
            {/* Points Synapse */}
            <div
              className="rounded-2xl p-5"
              style={{ background: 'linear-gradient(140deg, #2b2419, #4a3b23)' }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#d9c896' }}>
                Points Synapse
              </p>
              <p className="text-3xl font-extrabold mt-1" style={{ color: '#ffd873', fontFamily: 'var(--font-display)' }}>
                {points.toLocaleString('fr-FR')} ✦
              </p>
              <p className="text-xs mt-1 font-medium" style={{ color: '#bfae85' }}>
                {unlockedCount} succès débloqué{unlockedCount > 1 ? 's' : ''} sur {achievements.length}
              </p>
            </div>

            <AchievementRoadmap achievements={achievements} levels={levels} />
          </>
        )}
      </div>
    </div>
  )
}
