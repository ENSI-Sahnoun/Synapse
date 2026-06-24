import { getMyLoyaltyBalance } from '@/data/student/profile'

export default async function StudentLoyaltyPage() {
  const balance = await getMyLoyaltyBalance()

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Points Synapse</h1>
      <div className="rounded-xl bg-primary text-white p-6 text-center">
        <p className="text-xs opacity-75 uppercase tracking-wide">Solde actuel</p>
        <p className="text-5xl font-bold mt-2">{balance}</p>
        <p className="text-sm opacity-75 mt-1">points</p>
      </div>
      <p className="text-muted-foreground text-sm text-center">
        Les récompenses seront disponibles en Phase 5
      </p>
    </div>
  )
}
