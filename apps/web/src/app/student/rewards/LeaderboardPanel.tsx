'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'motion/react'
import type {
  LeaderboardRow,
  LeaderboardConfigRow,
  LeaderboardSettings,
  MyRank,
  LeaderboardCategory,
} from '@/data/student/leaderboard'
import type { Achievement, StudentLevel, AchievementUnlockers } from '@/data/student/achievements'
import { AchievementTreeSheet } from '@/components/student/AchievementTreeSheet'

function formatValue(category: LeaderboardCategory, value: number): string {
  if (category === 'visits') return `${Math.round(value)} visites`
  if (category === 'hours') return `${value.toFixed(1)}h`
  return `${value.toFixed(2)} DT`
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

const PODIUM_HEIGHTS = [64, 96, 48] // px: 2nd, 1st, 3rd
const MEDALS = ['🥈', '🥇', '🥉']

export function LeaderboardPanel({
  rows,
  myRanks,
  settings,
  config,
  achievements,
  levels,
  unlockers,
}: {
  rows: LeaderboardRow[]
  myRanks: MyRank[]
  settings: LeaderboardSettings
  config: LeaderboardConfigRow[]
  achievements: Achievement[]
  levels: StudentLevel[]
  unlockers: AchievementUnlockers
}) {
  const reduced = useReducedMotion()
  const enabledCats = config.filter((c) => c.enabled).sort((a, b) => a.sort_order - b.sort_order)
  const [active, setActive] = useState<LeaderboardCategory>(enabledCats[0]?.category ?? 'visits')

  // Build level lookup from levels prop
  const levelMap = Object.fromEntries(levels.map((l) => [l.student_id, l.level]))

  if (!settings.enabled || enabledCats.length === 0) return null

  const activeCfg = enabledCats.find((c) => c.category === active) ?? enabledCats[0]
  const catRows = rows.filter((r) => r.category === active).sort((a, b) => a.rank - b.rank)
  const podium = catRows.filter((r) => r.rank <= 3)
  const rest = catRows.filter((r) => r.rank > 3)
  const mine = myRanks.find((m) => m.category === active)

  const byRank = (n: number) => podium.find((r) => r.rank === n)
  const podiumOrder = [byRank(2), byRank(1), byRank(3)]

  const prizeLabel = settings.prizeSecret
    ? '🎁 Prix mystère'
    : `Fin du mois : 🥇${activeCfg.points_1} · 🥈${activeCfg.points_2} · 🥉${activeCfg.points_3} pts`

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: 'var(--synapse-cream-100)', borderColor: 'var(--synapse-cream-300)' }}
      >
      <div className="px-5 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--synapse-brown-500)' }}>
          Classement du mois
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{prizeLabel}</p>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 px-5 pt-3 pb-1 overflow-x-auto">
        {enabledCats.map((c) => (
          <button
            key={c.category}
            onClick={() => setActive(c.category)}
            className="flex items-center min-h-11 text-xs font-semibold px-4 py-1.5 rounded-full whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
            style={
              c.category === active
                ? { background: 'var(--synapse-green-600)', color: 'white' }
                : { background: 'white', color: 'var(--synapse-brown-700)' }
            }
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {/* Podium */}
      {podium.length > 0 ? (
        <div className="flex items-end justify-center gap-3 px-5 pt-4">
          {podiumOrder.map((r, i) =>
            r ? (
              <Link
                href={`/profile/${r.student_id}`}
                key={`${active}-${i}`}
                className="flex flex-col items-center gap-1 flex-1 max-w-[33%]"
              >
                <div className="relative w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold bg-white shadow-sm">
                  {initials(r.full_name)}
                  {levelMap[r.student_id] && (
                    <div
                      className="absolute -bottom-1 -right-1 text-[9px] font-bold rounded-full px-1 min-w-[16px] text-center"
                      style={{ background: 'var(--accent-brand)', color: 'white' }}
                    >
                      {levelMap[r.student_id]}
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-semibold text-center truncate w-full" title={r.full_name ?? ''}>
                  {r.full_name ?? 'Anonyme'}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                  {formatValue(active, r.value)}
                </span>
                <motion.div
                  className="w-full rounded-t-lg flex items-start justify-center pt-1 origin-bottom"
                  style={{ background: 'var(--synapse-cream-300)', height: PODIUM_HEIGHTS[i] }}
                  initial={reduced ? { scaleY: 1 } : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ type: 'spring', stiffness: 160, damping: 20, delay: reduced ? 0 : 0.1 * i }}
                >
                  <span className="text-lg">{MEDALS[i]}</span>
                </motion.div>
              </Link>
            ) : (
              <div key={`${active}-${i}`} className="flex-1 max-w-[33%]" />
            )
          )}
        </div>
      ) : (
        <p className="text-xs text-center py-6" style={{ color: 'var(--muted-foreground)' }}>
          Pas encore de classement ce mois-ci.
        </p>
      )}

      {/* Ranks 4+ */}
      {rest.length > 0 && (
        <div className="px-5 pt-4 flex flex-col gap-1.5">
          {rest.map((r, i) => (
            <motion.div
              key={`${active}-${r.student_id}`}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduced ? 0 : 0.3 + i * 0.05 }}
            >
              <Link href={`/profile/${r.student_id}`} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="text-xs font-semibold w-5" style={{ color: 'var(--muted-foreground)' }}>#{r.rank}</span>
                  <span className="truncate">{r.full_name ?? 'Anonyme'}</span>
                </span>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{formatValue(active, r.value)}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* My rank */}
      <div
        className="mt-4 mx-5 mb-4 rounded-lg px-4 py-2.5 flex items-center justify-between"
        style={{ background: 'var(--synapse-green-50)', color: 'var(--synapse-green-700)' }}
      >
        <span className="text-xs font-semibold">Votre position</span>
        <span className="text-sm font-bold">
          {mine && mine.rank ? `#${mine.rank} · ${formatValue(active, mine.value)}` : 'Non classé'}
        </span>
      </div>
      </div>

      {/* Achievement tree — collapsed behind a button */}
      <AchievementTreeSheet achievements={achievements} unlockers={unlockers} />
    </div>
  )
}
