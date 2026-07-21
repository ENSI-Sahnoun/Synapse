'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { Achievement, StudentLevel } from '@/data/student/achievements'

export function AchievementRoadmap({
  achievements,
  levels,
}: {
  achievements: Achievement[]
  levels: StudentLevel[]
}) {
  const reduced = useReducedMotion()

  if (achievements.length === 0) {
    return null
  }

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
        {achievements.map((achievement, i) => {
          const circleBg = achievement.unlocked
            ? 'var(--synapse-green-600)'
            : 'var(--synapse-cream-300)'
          const circleTextColor = achievement.unlocked ? 'white' : 'var(--muted-foreground)'
          const progressValue = Math.round(achievement.progress * (achievement.threshold ?? 100))
          const progressPercent = Math.round(achievement.progress * 100)

          return (
            <motion.div
              key={achievement.id}
              initial={reduced ? { opacity: 1 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduced ? 0 : 0.2 + i * 0.05 }}
              className="flex items-start gap-3"
            >
              {/* Icon circle */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: circleBg, color: circleTextColor }}
              >
                {achievement.emoji}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{achievement.title}</p>
                {achievement.description && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {achievement.description}
                  </p>
                )}

                {achievement.unlocked ? (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-semibold rounded-full px-2 py-0.5" style={{ background: 'var(--synapse-green-100)', color: 'var(--synapse-green-700)' }}>
                      ✓ Débloqué
                    </span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--synapse-green-600)' }}>
                      +{achievement.points} pts
                    </span>
                  </div>
                ) : achievement.category === 'manual' ? (
                  <div className="mt-1.5">
                    <span className="text-[10px] font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                      🔒 Succès spécial
                    </span>
                  </div>
                ) : (
                  <div className="mt-1.5">
                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--synapse-cream-300)' }}>
                      <div
                        className="h-full transition-all duration-300"
                        style={{ background: 'var(--synapse-green-600)', width: `${progressPercent}%` }}
                      />
                    </div>
                    {/* Progress label */}
                    <div className="text-[10px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
                      {achievement.threshold !== null
                        ? `${progressValue}/${achievement.threshold}`
                        : `${progressPercent}%`}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
