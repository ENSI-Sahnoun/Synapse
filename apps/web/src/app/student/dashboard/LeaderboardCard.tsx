'use client'

import { useState } from 'react'
import type {
  LeaderboardRow,
  LeaderboardConfigRow,
  LeaderboardSettings,
  MyRank,
  LeaderboardCategory,
} from '@/data/student/leaderboard'

function formatValue(category: LeaderboardCategory, value: number): string {
  if (category === 'visits') return `${Math.round(value)} visites`
  if (category === 'hours') return `${value.toFixed(1)}h`
  return `${value.toFixed(2)} DT`
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

export function LeaderboardCard({
  rows,
  myRanks,
  settings,
  config,
}: {
  rows: LeaderboardRow[]
  myRanks: MyRank[]
  settings: LeaderboardSettings
  config: LeaderboardConfigRow[]
}) {
  const enabledCats = config.filter((c) => c.enabled).sort((a, b) => a.sort_order - b.sort_order)
  const [active, setActive] = useState<LeaderboardCategory>(enabledCats[0]?.category ?? 'visits')

  if (!settings.enabled || enabledCats.length === 0) return null

  const activeCfg = enabledCats.find((c) => c.category === active) ?? enabledCats[0]
  const catRows = rows.filter((r) => r.category === active).sort((a, b) => a.rank - b.rank)
  const podium = catRows.filter((r) => r.rank <= 3)
  const rest = catRows.filter((r) => r.rank > 3)
  const mine = myRanks.find((m) => m.category === active)

  // podium display order: 2nd, 1st, 3rd
  const byRank = (n: number) => podium.find((r) => r.rank === n)
  const podiumOrder = [byRank(2), byRank(1), byRank(3)]
  const heights = ['h-16', 'h-24', 'h-12']
  const medals = ['🥈', '🥇', '🥉']

  const prizeLabel = settings.prizeSecret
    ? '🎁 Prix mystère'
    : `Fin du mois : 🥇${activeCfg.points_1} · 🥈${activeCfg.points_2} · 🥉${activeCfg.points_3} pts`

  return (
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

      {/* Tabs */}
      <div className="flex gap-2 px-5 pt-3 pb-1 overflow-x-auto">
        {enabledCats.map((c) => (
          <button
            key={c.category}
            onClick={() => setActive(c.category)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition-colors"
            style={
              c.category === active
                ? { background: 'var(--synapse-green-500)', color: 'white' }
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
              <div key={i} className="flex flex-col items-center gap-1 flex-1 max-w-[33%]">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold bg-white shadow-sm">
                  {initials(r.full_name)}
                </div>
                <span className="text-[11px] font-semibold text-center truncate w-full" title={r.full_name ?? ''}>
                  {r.full_name ?? 'Anonyme'}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                  {formatValue(active, r.value)}
                </span>
                <div
                  className={`${heights[i]} w-full rounded-t-lg flex items-start justify-center pt-1 transition-all`}
                  style={{ background: 'var(--synapse-cream-300)' }}
                >
                  <span className="text-lg">{medals[i]}</span>
                </div>
              </div>
            ) : (
              <div key={i} className="flex-1 max-w-[33%]" />
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
          {rest.map((r) => (
            <div key={r.student_id} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="text-xs font-semibold w-5" style={{ color: 'var(--muted-foreground)' }}>#{r.rank}</span>
                <span className="truncate">{r.full_name ?? 'Anonyme'}</span>
              </span>
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{formatValue(active, r.value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* My rank */}
      <div
        className="mt-4 mx-5 mb-4 rounded-lg px-4 py-2.5 flex items-center justify-between"
        style={{ background: 'var(--synapse-green-50)', color: 'var(--synapse-green-500)' }}
      >
        <span className="text-xs font-semibold">Votre position</span>
        <span className="text-sm font-bold">
          {mine && mine.rank ? `#${mine.rank} · ${formatValue(active, mine.value)}` : 'Non classé'}
        </span>
      </div>
    </div>
  )
}
