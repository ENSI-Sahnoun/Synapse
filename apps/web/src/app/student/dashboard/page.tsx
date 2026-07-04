import { getMyProfile, getMyActiveSubscription, getMyPresence } from '@/data/student/profile'
import { getMyImportantNotifications } from '@/data/notifications/list'
import { getLeaderboard, getMyLeaderboardRank, getLeaderboardSettings, getLeaderboardConfig } from '@/data/student/leaderboard'
import { differenceInDays, parseISO, format, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import { WarningCircle, ArrowRight, Megaphone } from '@phosphor-icons/react/dist/ssr'
import { QrCodeImage } from '@/components/student/QrCodeImage'
import { PresenceBanner } from './PresenceBanner'
import { LeaderboardCard } from './LeaderboardCard'

export default async function StudentDashboardPage() {
  const [profile, activeSubscription, presence, importantNotifications, lbRows, lbMyRanks, lbSettings, lbConfig] =
    await Promise.all([
      getMyProfile(),
      getMyActiveSubscription(),
      getMyPresence(),
      getMyImportantNotifications(),
      getLeaderboard(),
      getMyLeaderboardRank(),
      getLeaderboardSettings(),
      getLeaderboardConfig(),
    ])

  const today = startOfDay(new Date())

  const daysRemaining = activeSubscription
    ? differenceInDays(parseISO(activeSubscription.end_date), today)
    : 0

  const planDuration = (activeSubscription?.subscription_plans as { duration_days?: number } | null)?.duration_days ?? 30
  const progressPct = activeSubscription
    ? Math.max(0, Math.min(100, (daysRemaining / planDuration) * 100))
    : 0

  // Tiered color coding: healthy while most of the plan is left, warning as it
  // runs low, critical once nearly (or fully) expired.
  const planColor =
    progressPct > 50 ? 'var(--synapse-green-500)' : progressPct > 20 ? 'var(--synapse-orange-600, #ea580c)' : '#dc2626'
  const planColorBg =
    progressPct > 50 ? 'var(--synapse-green-50)' : progressPct > 20 ? 'rgba(234,88,12,0.1)' : '#fee2e2'

  const firstName = profile.full_name?.split(' ')[0] || 'étudiant'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <div className="space-y-4">
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

      {/* Important announcements — visible for 24h after being marked important */}
      {importantNotifications.map((n) => (
        <div
          key={n.id}
          className="rounded-xl flex items-start gap-3 px-4 py-3"
          style={{ background: '#fee2e2', border: '1px solid #fecaca' }}
        >
          <Megaphone size={18} weight="fill" style={{ color: '#dc2626', flexShrink: 0, marginTop: 2 }} />
          <p className="text-sm font-semibold" style={{ color: '#991b1b' }}>{n.message}</p>
        </div>
      ))}

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
            <div className="p-3 bg-white rounded-2xl shadow-sm">
              <QrCodeImage token={profile.qr_token} size={240} />
            </div>
            {profile.student_number && (
              <p className="text-xs font-mono font-semibold" style={{ color: 'var(--synapse-brown-700)' }}>
                #{profile.student_number}
              </p>
            )}
          </div>

          <div className="px-5 pb-4">
            <Link
              href="/student/qr"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold border transition-colors"
              style={{
                background: 'white',
                borderColor: 'var(--synapse-cream-300)',
                color: 'var(--synapse-brown-700)',
              }}
            >
              Agrandir le QR
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
              {daysRemaining} jours restants
            </p>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: 'var(--synapse-cream-200)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progressPct}%`, background: planColor }}
              />
            </div>

            {daysRemaining <= 3 && (
              <p className="text-xs flex items-center gap-1 mb-3" style={{ color: planColor }}>
                <WarningCircle size={13} weight="bold" />
                Abonnement expire bientôt — contactez l'accueil
              </p>
            )}

            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Expire le {format(parseISO(activeSubscription.end_date), 'dd MMMM yyyy', { locale: fr })}
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

      <LeaderboardCard rows={lbRows} myRanks={lbMyRanks} settings={lbSettings} config={lbConfig} />
    </div>
  )
}
