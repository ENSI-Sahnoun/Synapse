import { getAllChannelConfigs } from '@/data/admin/notification-channel-config'
import { ChannelConfigToggle } from '@/components/admin/notifications/ChannelConfigToggle'
import type { ChannelConfigRow } from '@/data/admin/notification-channel-config'
import type { NotificationType, NotificationChannel } from '@/lib/notification-types'

const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  expiry_7d: 'Expiration dans 7 jours',
  expiry_3d: 'Expiration dans 3 jours',
  expiry_1d: 'Expiration dans 1 jour',
  expired: 'Abonnement expiré (J-0)',
  renewal_reminder: 'Rappel de renouvellement (J+3)',
  reservation_confirmed: 'Réservation confirmée (étudiant)',
  reservation_new: 'Nouvelle réservation (personnel)',
  reservation_cancelled: 'Réservation annulée',
  reservation_accepted: 'Réservation acceptée par le personnel',
  points_earned: 'Points de fidélité gagnés',
  purchase_completed: 'Vente enregistrée (personnel)',
  subscription_new: 'Nouvel abonnement créé (personnel)',
  loyalty_request_new: 'Demande de récompense reçue (personnel)',
  loyalty_fulfilled: 'Récompense accordée (étudiant)',
  loyalty_rejected: 'Récompense refusée (étudiant)',
  room_almost_full: 'Salle presque pleine (personnel)',
  seat_swap_request_new: 'Demande de changement de place (personnel)',
  seat_swap_accepted: 'Changement de place accepté (étudiant)',
  seat_swap_denied: 'Changement de place refusé (étudiant)',
  announcement_new: 'Nouvelle annonce publiée',
}

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  inapp: 'In-app',
}

const ORDERED_TYPES: NotificationType[] = [
  'expiry_7d',
  'expiry_3d',
  'expiry_1d',
  'expired',
  'renewal_reminder',
  'reservation_confirmed',
  'reservation_new',
  'reservation_cancelled',
  'reservation_accepted',
  'points_earned',
  'purchase_completed',
  'subscription_new',
  'loyalty_request_new',
  'loyalty_fulfilled',
  'loyalty_rejected',
  'room_almost_full',
]

const CONFIGURABLE_CHANNELS: NotificationChannel[] = ['email', 'sms', 'whatsapp']

function buildConfigMap(rows: ChannelConfigRow[]): Map<string, boolean> {
  const map = new Map<string, boolean>()
  for (const row of rows) {
    map.set(`${row.notification_type}:${row.channel}`, row.is_enabled)
  }
  return map
}

export default async function NotificationConfigPage() {
  const configs = await getAllChannelConfigs()
  const configMap = buildConfigMap(configs)

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Canaux de notification</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configurez quels canaux sont actifs pour chaque type de notification.
          Les notifications in-app sont toujours activées.
        </p>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left p-4 font-medium text-muted-foreground">
                Type de notification
              </th>
              {CONFIGURABLE_CHANNELS.map((channel) => (
                <th key={channel} className="text-center p-4 font-medium text-muted-foreground w-28">
                  {CHANNEL_LABELS[channel]}
                </th>
              ))}
              <th className="text-center p-4 font-medium text-muted-foreground w-24">
                In-app
              </th>
            </tr>
          </thead>
          <tbody>
            {ORDERED_TYPES.map((type, index) => (
              <tr
                key={type}
                className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
              >
                <td className="p-4 font-medium">
                  {NOTIFICATION_TYPE_LABELS[type]}
                </td>
                {CONFIGURABLE_CHANNELS.map((channel) => (
                  <td key={channel} className="p-4 text-center">
                    <div className="flex justify-center">
                      <ChannelConfigToggle
                        notificationType={type}
                        channel={channel}
                        isEnabled={configMap.get(`${type}:${channel}`) ?? false}
                      />
                    </div>
                  </td>
                ))}
                <td className="p-4 text-center">
                  <div className="flex justify-center">
                    {/* In-app is always on — not configurable */}
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                      <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                      Toujours actif
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
        <h2 className="font-semibold text-sm">Variables d'environnement requises</h2>
        <ul className="text-xs text-muted-foreground space-y-1 font-mono">
          <li>RESEND_API_KEY — clé API Resend pour l'envoi d'emails</li>
          <li>TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER — SMS via Twilio</li>
          <li>WHATSAPP_API_TOKEN + WHATSAPP_PHONE_NUMBER_ID — Meta WhatsApp Business Cloud API</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Les canaux dont les variables ne sont pas configurées échoueront silencieusement
          (erreur enregistrée côté serveur, les autres canaux ne sont pas affectés).
        </p>
      </div>
    </div>
  )
}
