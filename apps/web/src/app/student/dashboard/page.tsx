import { getCachedLoggedInUserId } from '@/rsc-data/supabase'
import { getMyProfile, getMyLatestSubscription, getMyPresence } from '@/data/student/profile'
import { getMyLocker } from '@/data/student/lockers'
import { getMyImportantNotifications } from '@/data/notifications/list'
import { getMyLeaderboardRank, getLeaderboardSettings, getLeaderboardConfig } from '@/data/student/leaderboard'
import { getStudentLoyaltyBalance } from '@/data/student/loyalty'
import { differenceInDays, differenceInMinutes, parseISO, format, startOfDay, endOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import { WarningCircle, ArrowRight } from '@phosphor-icons/react/dist/ssr'
import { HoldToSendQr } from '@/components/student/HoldToSendQr'
import { PresenceBanner } from './PresenceBanner'
import { ImportantAnnouncements } from './ImportantAnnouncements'
import { LockerStatus } from './LockerStatus'
import { SubscriptionProgressBar } from './SubscriptionProgressBar'
import { GamificationTeaser } from '@/components/student/GamificationTeaser'
import { DiversSeatPrompt } from '@/components/student/DiversSeatPrompt'
import { StudentPresenceSync } from '@/components/student/StudentPresenceSync'
import { LiveRefresher } from '@/components/live/LiveRefresher'
import { SubscriptionStatusPopup } from '@/components/student/SubscriptionStatusPopup'
import { computeSubscriptionState, isDailyPlan } from '@/lib/subscription-status'

export default async function StudentDashboardPage() {
  const userId = await getCachedLoggedInUserId()

  const [profile, latestSubscription, presence, importantNotifications, lbMyRanks, lbSettings, lbConfig, balance, locker] =
    await Promise.all([
      getMyProfile(),
      getMyLatestSubscription(),
      getMyPresence(),
      getMyImportantNotifications(),
      getMyLeaderboardRank(),
      getLeaderboardSettings(),
      getLeaderboardConfig(),
      getStudentLoyaltyBalance(userId),
      getMyLocker(),
    ])

  const enabledCats = lbConfig.filter((c) => c.enabled).sort((a, b) => a.sort_order - b.sort_order)
  const leaderboardVisible = lbSettings.enabled && enabledCats.length > 0
  const primaryCategory = enabledCats[0]?.category
  const myRank = lbMyRanks.find((m) => m.category === primaryCategory)?.rank ?? null

  const today = startOfDay(new Date())
  const todayStr = format(today, 'yyyy-MM-dd')

  const subscriptionState = latestSubscription
    ? computeSubscriptionState(latestSubscription.end_date, todayStr)
    : null
  const activeSubscription = subscriptionState && subscriptionState !== 'expired' ? latestSubscription : null

  const daysRemaining = activeSubscription
    ? differenceInDays(parseISO(activeSubscription.end_date), today)
    : 0

  const planDuration = (activeSubscription?.subscription_plans as { duration_days?: number } | null)?.duration_days ?? 30
  const isDaily = isDailyPlan((activeSubscription?.subscription_plans as { name?: string } | null)?.name)

  // Daily plans (journalier/demi) and the last day of any plan read as
  // "hours left" instead of "X jours restants" — a day count is meaningless
  // when there's only a day (or less) of validity remaining.
  const showHoursMode = activeSubscription != null && (isDaily || daysRemaining <= 1)
  const hoursRemaining =
    activeSubscription && showHoursMode
      ? Math.max(0, Math.ceil(differenceInMinutes(endOfDay(parseISO(activeSubscription.end_date)), new Date()) / 60))
      : 0

  const progressPct = activeSubscription
    ? showHoursMode
      ? Math.max(0, Math.min(100, (hoursRemaining / 24) * 100))
      : Math.max(0, Math.min(100, (daysRemaining / planDuration) * 100))
    : 0

  // Tiered color coding: healthy while most of the time is left, critical
  // once it's down to a few hours. Hours-mode reads green until the last
  // stretch of the day, days-mode keeps the original 50%/20% tiers.
  const isCritical = showHoursMode ? hoursRemaining <= 4 : progressPct <= 20
  const isWarning = !showHoursMode && progressPct > 20 && progressPct <= 50
  const planColor = isCritical ? 'var(--destructive)' : isWarning ? 'var(--synapse-orange-600, #ea580c)' : 'var(--synapse-green-500)'
  const planColorBg = isCritical ? 'var(--error-bg)' : isWarning ? 'rgba(234,88,12,0.1)' : 'var(--synapse-green-50)'

  const firstName = profile.full_name?.split(' ')[0] || 'étudiant'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <div className="space-y-4">
      <LiveRefresher tables={['attendance', 'reservations', 'seats']} />
      <StudentPresenceSync studentId={userId} />
      {presence.status === 'divers' && <DiversSeatPrompt attendanceId={presence.attendanceId} />}

      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          {greeting}, {firstName} ☀️
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          {profile.university ?? 'Synapse — votre espace de travail'}
        </p>
      </div>

      {/* Presence banner */}
      <PresenceBanner presence={presence} />

      {/* Important announcements — visible for 24h after being marked important, live via realtime, dismissible */}
      <ImportantAnnouncements initial={importantNotifications} />

      {/* QR Card */}
      {profile.qr_token ? (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--synapse-cream-100)', borderColor: 'var(--synapse-cream-300)' }}
        >
          <div className="flex items-center justify-between px-5 pt-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--synapse-brown-500)' }}>
                QR de check-in
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                Scannez à l'entrée
              </p>
            </div>
            <span
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5"
              style={{ background: 'var(--synapse-green-50)', color: 'var(--synapse-green-500)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
              Prêt
            </span>
          </div>

          <div className="flex flex-col items-center px-5 py-5 gap-3">
            <HoldToSendQr token={profile.qr_token} size={240} />
          </div>

          <div className="px-5 pb-4">
            <Link
              href="/student/qr"
              className="flex items-center justify-center gap-2 w-full py-3 min-h-11 rounded-lg text-sm font-semibold border transition-colors"
              style={{
                background: 'white',
                borderColor: 'var(--synapse-cream-300)',
                color: 'var(--synapse-brown-700)',
              }}
            >
              Plus de détails
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed p-5 text-center space-y-1" style={{ borderColor: 'var(--border-default)' }}>
          <p className="font-semibold text-sm">QR code non disponible</p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Contactez l'accueil pour l'activer.
          </p>
        </div>
      )}

      {/* Subscription card */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: 'var(--border-subtle)' }}>
        {activeSubscription ? (
          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  Mon abonnement
                </p>
                <p className="text-lg font-bold mt-0.5" style={{ fontFamily: 'var(--font-display)' }}>
                  {(activeSubscription.subscription_plans as { name: string })?.name}
                </p>
              </div>
              <span
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5"
                style={{ background: planColorBg, color: planColor }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                Actif
              </span>
            </div>

            <p className="text-sm mb-2 font-semibold" style={{ color: planColor }}>
              {showHoursMode
                ? hoursRemaining <= 1
                  ? "Moins d'1h restante"
                  : `${hoursRemaining}h restantes`
                : `${daysRemaining} jours restants`}
            </p>

            {/* Progress bar — animates in on mount (see SubscriptionProgressBar) */}
            <SubscriptionProgressBar pct={progressPct} color={planColor} />

            {isCritical && (
              <p className="text-xs flex items-center gap-1 mb-3" style={{ color: planColor }}>
                <WarningCircle size={13} weight="bold" />
                Abonnement expire bientôt — contactez l'accueil
              </p>
            )}

            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Expire le {format(parseISO(activeSubscription.end_date), 'dd MMMM yyyy', { locale: fr })}
            </p>
          </div>
        ) : subscriptionState === 'expired' && latestSubscription ? (
          <div className="p-5 text-center space-y-1">
            <p className="font-semibold text-sm" style={{ color: 'var(--destructive)' }}>
              Votre abonnement a expiré
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Il s'est terminé le {format(parseISO(latestSubscription.end_date), 'dd MMMM yyyy', { locale: fr })} —
              rendez-vous à l'accueil pour le renouveler
            </p>
          </div>
        ) : (
          <div className="p-5 text-center space-y-1">
            <p className="font-semibold text-sm">Aucun abonnement actif</p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Rendez-vous à l'accueil pour souscrire
            </p>
          </div>
        )}
      </div>

      {latestSubscription &&
        subscriptionState &&
        !(isDaily && (subscriptionState === 'expiring_soon' || subscriptionState === 'expires_today')) && (
          <SubscriptionStatusPopup
            subscriptionId={latestSubscription.id}
            state={subscriptionState}
            endDateLabel={format(parseISO(latestSubscription.end_date), 'dd MMMM yyyy', { locale: fr })}
          />
        )}

      <LockerStatus locker={locker} />

      <GamificationTeaser balance={balance} myRank={myRank} leaderboardVisible={leaderboardVisible} />
    </div>
  )
}
