import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { getCachedLoggedInUserIdOrNull } from '@/rsc-data/supabase'
import { QrCodeImage } from '@/components/student/QrCodeImage'
import { SignIn, ShoppingCart, Star, Key } from '@phosphor-icons/react/dist/ssr'

export const metadata = {
  title: 'Mon QR Code — Synapse',
}

const QR_USES = [
  {
    icon: SignIn,
    title: 'Check-in à l’entrée',
    body: 'Présentez ce code au kiosque ou à un employé pour être marqué présent et obtenir votre place.',
  },
  {
    icon: ShoppingCart,
    title: 'Achats à la caisse',
    body: 'Scannez-le à la caisse pour acheter vos articles — le paiement et vos points sont liés à votre compte.',
  },
  {
    icon: Star,
    title: 'Points de fidélité',
    body: 'Votre QR vous identifie : vous cumulez des points à chaque passage et pouvez les échanger contre des récompenses.',
  },
  {
    icon: Key,
    title: 'Code secret de secours',
    body: 'Si le scanner ne fonctionne pas, l’employé peut saisir votre code secret manuellement (bouton ci-dessous).',
  },
]

export default async function StudentQrPage() {
  const supabase = await createSupabaseClient()
  const userId = await getCachedLoggedInUserIdOrNull()
  if (!userId) redirect('/login')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, qr_token, student_number')
    .eq('id', userId)
    .single()

  if (error || !profile) redirect('/login')

  if (!profile.qr_token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <p className="text-destructive text-sm">
          Votre code QR n&apos;est pas encore disponible.
        </p>
        <p className="text-muted-foreground text-xs">
          Contactez l&apos;accueil pour l&apos;activer.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        {/* Left: the QR + secret code */}
        <div
          className="flex flex-col items-center justify-center gap-5 rounded-2xl border p-6 text-center"
          style={{ background: 'var(--synapse-cream-100)', borderColor: 'var(--synapse-cream-300)' }}
        >
          <div>
            <h1 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              Mon QR Code
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {profile.full_name}
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-lg">
            <QrCodeImage token={profile.qr_token} size={280} />
          </div>

          <div className="w-full max-w-xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--synapse-brown-500)' }}>
              Code secret
            </p>
            <p
              className="mt-1 text-xs font-mono break-all rounded-lg px-3 py-2 select-all"
              style={{ background: 'var(--synapse-cream-200)', color: 'var(--synapse-brown-700)' }}
            >
              {profile.qr_token}
            </p>
          </div>
        </div>

        {/* Right: what the QR can do */}
        <div
          className="flex flex-col gap-4 rounded-2xl border p-6"
          style={{ background: 'white', borderColor: 'var(--border-subtle)' }}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--synapse-brown-500)' }}>
              À quoi ça sert
            </p>
            <h2 className="text-lg font-semibold mt-0.5" style={{ fontFamily: 'var(--font-display)' }}>
              Ce que votre QR peut faire
            </h2>
          </div>

          <ul className="flex flex-col gap-3">
            {QR_USES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-xl"
                  style={{ width: 40, height: 40, background: 'var(--synapse-green-50)' }}
                >
                  <Icon size={20} weight="duotone" style={{ color: 'var(--synapse-green-600, #16a34a)' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {title}
                  </p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <p className="text-xs mt-auto pt-2 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            Gardez votre QR pour vous : il est lié à votre compte et à votre abonnement.
          </p>
        </div>
      </div>
    </div>
  )
}
