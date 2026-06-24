import { getMyProfile, getMyActiveSubscription, getMyLoyaltyBalance } from '@/data/student/profile'
import { differenceInDays, parseISO, format, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function StudentDashboardPage() {
  const [profile, activeSubscription, loyaltyBalance] = await Promise.all([
    getMyProfile(),
    getMyActiveSubscription(),
    getMyLoyaltyBalance(),
  ])

  const today = startOfDay(new Date())
  const daysRemaining = activeSubscription
    ? differenceInDays(parseISO(activeSubscription.end_date), today)
    : 0

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Bonjour, {profile.full_name?.split(' ')[0] || 'étudiant'}</h1>
        <p className="text-muted-foreground text-sm">{profile.university ?? 'Synapse'}</p>
      </div>

      {/* Subscription card */}
      {activeSubscription ? (
        <div className={`rounded-xl p-5 text-white ${daysRemaining <= 3 ? 'bg-destructive' : 'bg-primary'}`}>
          <p className="text-xs uppercase tracking-wide opacity-75">Abonnement actif</p>
          <p className="text-2xl font-bold mt-1">
            {(activeSubscription.subscription_plans as { name: string })?.name}
          </p>
          <div className="mt-3 flex justify-between text-sm">
            <div>
              <p className="opacity-75 text-xs">Expire le</p>
              <p className="font-semibold">
                {format(parseISO(activeSubscription.end_date), 'dd MMMM yyyy', { locale: fr })}
              </p>
            </div>
            <div className="text-right">
              <p className="opacity-75 text-xs">Jours restants</p>
              <p className="font-bold text-2xl">{daysRemaining}</p>
            </div>
          </div>
          {daysRemaining <= 3 && (
            <p className="mt-2 text-xs opacity-90">
              ⚠️ Votre abonnement expire bientôt — contactez l'accueil pour renouveler
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed p-5 text-center space-y-2">
          <p className="font-medium">Aucun abonnement actif</p>
          <p className="text-muted-foreground text-sm">
            Rendez-vous à l'accueil pour souscrire à une formule
          </p>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Points Synapse</p>
          <p className="text-2xl font-bold mt-1">{loyaltyBalance}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Membre depuis</p>
          <p className="font-semibold mt-1 text-sm">
            {format(parseISO(profile.created_at), 'MMM yyyy', { locale: fr })}
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="space-y-2">
        <Button asChild variant="outline" className="w-full justify-start">
          <Link href="/student/qr">Mon QR Code</Link>
        </Button>
        <Button asChild variant="outline" className="w-full justify-start">
          <Link href="/student/loyalty">Mes récompenses</Link>
        </Button>
      </div>
    </div>
  )
}
