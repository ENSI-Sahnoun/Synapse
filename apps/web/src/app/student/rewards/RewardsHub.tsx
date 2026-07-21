'use client'

import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import type {
  LeaderboardRow,
  LeaderboardConfigRow,
  LeaderboardSettings,
  MyRank,
} from '@/data/student/leaderboard'
import type { LoyaltyRule, NextReward } from '@/lib/rewards'
import type { Achievement, StudentLevel, AchievementUnlockers } from '@/data/student/achievements'
import { PointsHero } from './PointsHero'
import { LeaderboardPanel } from './LeaderboardPanel'
import { RewardsPanel, type RedemptionRequest } from './RewardsPanel'
import { HistoryPanel, type LedgerEntry } from './HistoryPanel'

type TabId = 'leaderboard' | 'rewards' | 'history'

export function RewardsHub({
  balance,
  delta,
  next,
  ledger,
  rules,
  pendingRuleIds,
  requests,
  lbRows,
  lbMyRanks,
  lbSettings,
  lbConfig,
  achievements,
  levels,
  unlockers,
}: {
  balance: number
  delta: number
  next: NextReward | null
  ledger: LedgerEntry[]
  rules: LoyaltyRule[]
  pendingRuleIds: string[]
  requests: RedemptionRequest[]
  lbRows: LeaderboardRow[]
  lbMyRanks: MyRank[]
  lbSettings: LeaderboardSettings
  lbConfig: LeaderboardConfigRow[]
  achievements: Achievement[]
  levels: StudentLevel[]
  unlockers: AchievementUnlockers
}) {
  const reduced = useReducedMotion()
  const leaderboardVisible = lbSettings.enabled && lbConfig.some((c) => c.enabled)

  const tabs: { id: TabId; label: string }[] = [
    ...(leaderboardVisible ? [{ id: 'leaderboard' as const, label: '🏆 Classement' }] : []),
    { id: 'rewards', label: '🎁 Récompenses' },
    { id: 'history', label: '📜 Historique' },
  ]
  const [active, setActive] = useState<TabId>(tabs[0].id)

  return (
    <div className="space-y-4">
      <PointsHero balance={balance} delta={delta} next={next} />

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className="relative flex items-center min-h-11 text-xs font-semibold px-3.5 py-2 rounded-full whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
            style={{ color: t.id === active ? 'white' : 'var(--synapse-brown-700)' }}
          >
            {t.id === active && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-full"
                style={{ background: 'var(--synapse-green-600)' }}
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Panel */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={active}
          initial={reduced ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? undefined : { opacity: 0, x: -12 }}
          transition={{ duration: 0.18 }}
        >
          {active === 'leaderboard' && (
            <LeaderboardPanel
              rows={lbRows}
              myRanks={lbMyRanks}
              settings={lbSettings}
              config={lbConfig}
              achievements={achievements}
              levels={levels}
              unlockers={unlockers}
            />
          )}
          {active === 'rewards' && (
            <RewardsPanel balance={balance} rules={rules} pendingRuleIds={pendingRuleIds} requests={requests} />
          )}
          {active === 'history' && <HistoryPanel ledger={ledger} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
