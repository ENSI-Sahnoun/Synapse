'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { Achievement } from '@/data/student/achievements'
import { resolveAchievementIcon } from '@/utils/achievement-icons'

const CATEGORY_ORDER: Achievement['category'][] = ['visits', 'hours', 'streak', 'spend', 'purchase_count', 'manual']

// The single tier a viewer should see for a category: the next locked one
// they're working toward, or — once every tier is cleared — the highest
// one, shown as a completed trophy. Fully-locked tiers beyond the current
// one never render; this is a "current quest" view, not a full tree.
function currentTierFor(categoryAchievements: Achievement[]): Achievement | null {
  const sorted = [...categoryAchievements].sort((a, b) => (a.threshold ?? 0) - (b.threshold ?? 0))
  const nextLocked = sorted.find((a) => !a.unlocked)
  if (nextLocked) return nextLocked
  return sorted[sorted.length - 1] ?? null
}

export function AchievementRoadmap({ achievements }: { achievements: Achievement[] }) {
  const reduced = useReducedMotion()

  const byCategory = new Map<Achievement['category'], Achievement[]>()
  for (const a of achievements) {
    const list = byCategory.get(a.category) ?? []
    list.push(a)
    byCategory.set(a.category, list)
  }

  const cards = CATEGORY_ORDER.map((c) => currentTierFor(byCategory.get(c) ?? []))
    // Manual achievements only ever surface once earned — an unearned
    // "special" tier is a secret, not a quest to display.
    .filter((a): a is Achievement => a !== null && !(a.category === 'manual' && !a.unlocked))

  if (cards.length === 0) return null

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--synapse-cream-100)', borderColor: 'var(--synapse-cream-300)' }}
    >
      <div className="px-5 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--synapse-brown-500)' }}>
          Parcours de succès
        </p>
      </div>

      <div className="px-5 py-4 space-y-3">
        {cards.map((achievement, i) => (
          <motion.div
            key={achievement.id}
            initial={reduced ? { opacity: 1 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0 : 0.15 + i * 0.06, duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          >
            {achievement.unlocked ? <UnlockedCard achievement={achievement} reduced={!!reduced} /> : <QuestCard achievement={achievement} reduced={!!reduced} />}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function UnlockedCard({ achievement, reduced }: { achievement: Achievement; reduced: boolean }) {
  const Icon = resolveAchievementIcon(achievement.emoji)
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative w-11 h-11 rounded-full flex items-center justify-center text-lg flex-shrink-0"
        style={{ background: 'var(--synapse-green-600)', color: 'white' }}
      >
        {!reduced && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: '0 0 0 0 var(--synapse-green-400)' }}
            animate={{ boxShadow: ['0 0 0 0 rgba(34,197,94,0.35)', '0 0 0 8px rgba(34,197,94,0)'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <Icon size={20} weight="fill" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">{achievement.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="text-[10px] font-semibold rounded-full px-2 py-0.5"
            style={{ background: 'var(--synapse-green-100)', color: 'var(--synapse-green-700)' }}
          >
            ✓ Débloqué
          </span>
          <span className="text-xs font-semibold" style={{ color: 'var(--synapse-green-600)' }}>
            +{achievement.points} pts
          </span>
        </div>
      </div>
    </div>
  )
}

function QuestCard({ achievement, reduced }: { achievement: Achievement; reduced: boolean }) {
  const Icon = resolveAchievementIcon(achievement.emoji)
  const progressPercent = Math.round(achievement.progress * 100)
  const progressValue = Math.round(achievement.progress * (achievement.threshold ?? 100))

  return (
    <div
      className="relative flex items-center gap-3 rounded-xl p-2.5 overflow-hidden border"
      style={{ background: 'var(--synapse-cream-50)', borderColor: 'var(--synapse-cream-300)' }}
    >
      {/* ambient sweep, purely decorative — this card is seen rarely (once per profile visit) */}
      {!reduced && (
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(120deg, transparent 20%, rgba(47,115,80,0.06) 45%, transparent 70%)',
          }}
          animate={{ x: ['-100%', '150%'] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'linear', repeatDelay: 1.4 }}
        />
      )}

      <div
        className="relative w-11 h-11 rounded-full flex items-center justify-center text-lg flex-shrink-0"
        style={{ background: 'var(--synapse-green-100)', color: 'var(--synapse-green-700)' }}
      >
        <Icon size={20} weight="fill" />
      </div>

      <div className="relative flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{achievement.title}</p>
        {achievement.threshold !== null && (
          <>
            <div className="h-1.5 rounded-full overflow-hidden mt-1.5" style={{ background: 'var(--synapse-cream-300)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'var(--synapse-green-600)' }}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              />
            </div>
            <p className="text-[10px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {progressValue}/{achievement.threshold}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
