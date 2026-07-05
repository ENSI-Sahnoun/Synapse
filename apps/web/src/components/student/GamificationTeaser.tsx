import Link from 'next/link'
import { Trophy, ArrowRight } from '@phosphor-icons/react/dist/ssr'

export function GamificationTeaser({
  balance,
  myRank,
  leaderboardVisible,
}: {
  balance: number
  myRank: number | null
  leaderboardVisible: boolean
}) {
  return (
    <Link
      href="/student/rewards"
      className="flex items-center gap-3 rounded-xl p-4 transition-transform active:scale-[0.99]"
      style={{ background: 'linear-gradient(140deg, #2b2419, #4a3b23)' }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{ background: 'rgba(255,216,115,0.15)' }}
      >
        <Trophy size={20} weight="fill" style={{ color: '#ffd873' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: '#ffd873' }}>
          {balance.toLocaleString('fr-FR')} pts ✦
        </p>
        <p className="text-xs" style={{ color: '#bfae85' }}>
          {leaderboardVisible && myRank ? `#${myRank} au classement du mois` : 'Récompenses & classement'}
        </p>
      </div>
      <ArrowRight size={16} style={{ color: '#d9c896' }} />
    </Link>
  )
}
