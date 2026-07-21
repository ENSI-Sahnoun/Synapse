import { listAchievements, listLevels, listManualAchievements } from '@/data/admin/achievements'
import { AchievementDialog } from './achievement-dialog'
import { LevelDialog } from './level-dialog'
import { ManualGrantPanel } from './manual-grant-panel'
import { ToggleAchievementButton } from './toggle-achievement-button'
import { LiveRefresher } from '@/components/live/LiveRefresher'

const CATEGORY_LABELS: Record<string, string> = {
  visits: 'Visites',
  hours: 'Heures',
  spend: 'Dépenses',
  purchase_count: 'Nombre d\'achats',
  streak: 'Séquence',
  manual: 'Attribution manuelle',
}

export const dynamic = 'force-dynamic'

export default async function AdminAchievementsPage() {
  const [achievements, levels, manualAchievements] = await Promise.all([
    listAchievements(),
    listLevels(),
    listManualAchievements(),
  ])

  return (
    <div className="space-y-6 px-4 md:px-0">
      <LiveRefresher tables={['achievements', 'levels', 'achievement_unlocks']} />

      {/* Achievements Section */}
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Succès & niveaux</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gérez les succès et les niveaux de progression des étudiants.
            </p>
          </div>
          <AchievementDialog mode="create" />
        </div>

        <div className="border rounded-md overflow-x-auto mt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2">Emoji</th>
                <th className="text-left px-4 py-2">Titre</th>
                <th className="text-left px-4 py-2">Catégorie</th>
                <th className="text-left px-4 py-2">Seuil</th>
                <th className="text-left px-4 py-2">Points</th>
                <th className="text-left px-4 py-2">Statut</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {achievements.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="animate-in fade-in duration-200 px-4 py-8 text-center text-muted-foreground"
                  >
                    Aucun succès défini.
                  </td>
                </tr>
              )}
              {achievements.map((achievement) => (
                <tr key={achievement.id} className="border-b last:border-0">
                  <td className="px-4 py-2 text-lg">{achievement.emoji}</td>
                  <td className="px-4 py-2 font-medium">{achievement.title}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {CATEGORY_LABELS[achievement.category] ??
                      achievement.category}
                  </td>
                  <td className="px-4 py-2">
                    {achievement.threshold ?? '—'}
                  </td>
                  <td className="px-4 py-2">{achievement.points} pts</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        achievement.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {achievement.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-4 py-2 flex items-center gap-2">
                    <AchievementDialog mode="edit" achievement={achievement} />
                    <ToggleAchievementButton
                      id={achievement.id}
                      isActive={achievement.is_active}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Levels Section */}
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Niveaux</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configuration des niveaux de progression.
            </p>
          </div>
          <LevelDialog mode="create" />
        </div>

        <div className="border rounded-md overflow-x-auto mt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2">Niveau</th>
                <th className="text-left px-4 py-2">XP requis</th>
                <th className="text-left px-4 py-2">Libellé</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {levels.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="animate-in fade-in duration-200 px-4 py-8 text-center text-muted-foreground"
                  >
                    Aucun niveau défini.
                  </td>
                </tr>
              )}
              {levels.map((level) => (
                <tr key={level.level} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">{level.level}</td>
                  <td className="px-4 py-2">{level.xp_required} XP</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {level.label ?? '—'}
                  </td>
                  <td className="px-4 py-2 flex items-center gap-2">
                    <LevelDialog mode="edit" level={level} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Grant Section */}
      {manualAchievements.length > 0 && (
        <ManualGrantPanel achievements={manualAchievements} />
      )}
    </div>
  )
}
