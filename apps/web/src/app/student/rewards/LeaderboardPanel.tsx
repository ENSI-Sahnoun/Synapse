'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'motion/react'
import { Medal, Gift, DoorOpen, BookOpen, CreditCard, type Icon } from '@phosphor-icons/react'
import type {
  LeaderboardRow,
  LeaderboardConfigRow,
  LeaderboardSettings,
  MyRank,
  LeaderboardCategory,
} from '@/data/student/leaderboard'
import type { Achievement, AchievementUnlockers } from '@/data/student/achievements'
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
const MEDAL_COLORS = ['#c0c0c0', '#ffd873', '#cd7f32'] // 2nd, 1st, 3rd

const CATEGORY_ICONS: Record<LeaderboardCategory, Icon> = {
  visits: DoorOpen,
  hours: BookOpen,
  spend: CreditCard,
}

export function LeaderboardPanel({
  rows,
  myRanks,
  settings,
  config,
  achievements,
  unlockers,
}: {
  rows: LeaderboardRow[]
  myRanks: MyRank[]
  settings: LeaderboardSettings
  config: LeaderboardConfigRow[]
  achievements: Achievement[]
  unlockers: AchievementUnlockers
}) {
  const reduced = useReducedMotion()
  const enabledCats = config.filter((c) => c.enabled).sort((a, b) => a.sort_order - b.sort_order)
  const [active, setActive] = useState<LeaderboardCategory>(enabledCats[0]?.category ?? 'visits')

  if (!settings.enabled || enabledCats.length === 0) return null

  const activeCfg = enabledCats.find((c) => c.category === active) ?? enabledCats[0]
  const catRows = rows.filter((r) => r.category === active).sort((a, b) => a.rank - b.rank)
  // Top 3 *positions*, not literal rank numbers — ties make Postgres' rank()
  // skip numbers (e.g. two people tied at #1 puts the next distinct row at
  // #3), which used to leave an empty pedestal in the podium.
  const podium = catRows.slice(0, 3)
  const rest = catRows.slice(3)
  const mine = myRanks.find((m) => m.category === active)

  const podiumOrder = [podium[1], podium[0], podium[2]]

  const prizeLabel = settings.prizeSecret ? (
    <span className="inline-flex items-center gap-1">
      <Gift size={12} weight="fill" /> Prix mystère
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 flex-wrap">
      Fin du mois :
      <Medal size={12} weight="fill" style={{ color: MEDAL_COLORS[1] }} />{activeCfg.points_1} ·
      <Medal size={12} weight="fill" style={{ color: MEDAL_COLORS[0] }} />{activeCfg.points_2} ·
      <Medal size={12} weight="fill" style={{ color: MEDAL_COLORS[2] }} />{activeCfg.points_3} pts
    </span>
  )

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
      <div className="flex gap-2 px-5 pt-3 pb-1">
        {enabledCats.map((c) => {
          const CatIcon = CATEGORY_ICONS[c.category]
          return (
            <button
              key={c.category}
              onClick={() => setActive(c.category)}
              className="flex flex-1 items-center justify-center gap-1 min-w-0 min-h-11 text-xs font-semibold px-2 py-1.5 rounded-full whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
              style={
                c.category === active
                  ? { background: 'var(--synapse-green-600)', color: 'white' }
                  : { background: 'white', color: 'var(--synapse-brown-700)' }
              }
            >
              <CatIcon size={14} weight="fill" />
              <span className="truncate">{c.label}</span>
            </button>
          )
        })}
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
                  <span
                    className="flex items-center justify-center w-8 h-8 rounded-full"
                    style={{ background: 'white', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}
                  >
                    <Medal size={20} weight="fill" style={{ color: MEDAL_COLORS[i] }} />
                  </span>
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
