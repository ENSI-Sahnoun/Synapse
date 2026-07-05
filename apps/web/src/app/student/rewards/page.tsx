import { createSupabaseClient } from '@/supabase-clients/server'
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
import { getNextReward, weeklyDelta } from '@/lib/rewards'
import { RewardsHub } from './RewardsHub'
import type { RedemptionRequest } from './RewardsPanel'

export default async function StudentRewardsPage() {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const studentId = user!.id

  const [balance, ledger, rules, pendingRuleIds, requests, lbRows, lbMyRanks, lbSettings, lbConfig] =
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
    ])

  return (
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
    />
  )
}
