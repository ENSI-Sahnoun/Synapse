import { getLeaderboardSettings, getLeaderboardConfig } from '@/data/student/leaderboard'
import { LeaderboardSettingsCards } from './LeaderboardSettingsCards'

export const dynamic = 'force-dynamic'

export default async function AdminLeaderboardSettingsPage() {
  const [settings, config] = await Promise.all([getLeaderboardSettings(), getLeaderboardConfig()])
  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Classement</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configuration du classement mensuel des étudiants et des récompenses.
        </p>
      </div>
      <LeaderboardSettingsCards initialSettings={settings} initialConfig={config} />
    </div>
  )
}
