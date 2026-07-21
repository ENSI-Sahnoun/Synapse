import { getCachedLoggedInUserId } from '@/rsc-data/supabase'
import {
  getStudentLoyaltyBalance,
  getStudentLoyaltyLedger,
  getActiveLoyaltyRules,
  getStudentPendingRequestRuleIds,
  getStudentRedemptionRequests,
} from '@/data/student/loyalty'
import {
  getLeaderboard,
  getMyLeaderboardRank,
  getLeaderboardSettings,
  getLeaderboardConfig,
} from '@/data/student/leaderboard'
import { getMyAchievements, getAchievementUnlockers } from '@/data/student/achievements'
import { getNextReward, weeklyDelta } from '@/lib/rewards'
import { RewardsHub } from './RewardsHub'
import type { RedemptionRequest } from './RewardsPanel'
import { LiveRefresher } from '@/components/live/LiveRefresher'

export default async function StudentRewardsPage() {
  const studentId = await getCachedLoggedInUserId()

  const [balance, ledger, rules, pendingRuleIds, requests, lbRows, lbMyRanks, lbSettings, lbConfig, achievements] =
    await Promise.all([
      getStudentLoyaltyBalance(studentId),
      getStudentLoyaltyLedger(studentId),
      getActiveLoyaltyRules(),
      getStudentPendingRequestRuleIds(studentId),
      getStudentRedemptionRequests(studentId),
      getLeaderboard(),
      getMyLeaderboardRank(),
      getLeaderboardSettings(),
      getLeaderboardConfig(),
      getMyAchievements(),
    ])

  const unlockers = await getAchievementUnlockers(achievements.map((a) => a.id))

  return (
    <>
    <LiveRefresher tables={['loyalty_ledger', 'loyalty_redemption_requests', 'loyalty_rules', 'profiles', 'achievement_unlocks']} />
    <RewardsHub
      balance={balance}
      delta={weeklyDelta(ledger)}
      next={getNextReward(balance, rules)}
      ledger={ledger}
      rules={rules}
      pendingRuleIds={pendingRuleIds}
      requests={requests as unknown as RedemptionRequest[]}
      lbRows={lbRows}
      lbMyRanks={lbMyRanks}
      lbSettings={lbSettings}
      lbConfig={lbConfig}
      achievements={achievements}
      unlockers={unlockers}
    />
    </>
  )
}
