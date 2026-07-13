import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { getCachedLoggedInUserIdOrNull } from '@/rsc-data/supabase'
import { QrCodeImage } from '@/components/student/QrCodeImage'

export const metadata = {
  title: 'Mon QR — Synapse',
}

export default async function EmployeeQrPage() {
  const supabase = await createSupabaseClient()
  const userId = await getCachedLoggedInUserIdOrNull()
  if (!userId) redirect('/login')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, qr_token')
    .eq('id', userId)
    .single()

  if (error || !profile) redirect('/login')

  if (!profile.qr_token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <p className="text-destructive text-sm">Votre code QR n&apos;est pas encore disponible.</p>
        <p className="text-muted-foreground text-xs">Contactez l&apos;administration pour l&apos;activer.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md py-2">
      <div
        className="flex flex-col items-center justify-center gap-5 rounded-2xl border p-4 sm:p-6 text-center"
        style={{ background: 'var(--synapse-cream-100)', borderColor: 'var(--synapse-cream-300)' }}
      >
        <div>
          <h1 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
            Mon QR
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {profile.full_name}
          </p>
        </div>

        <QrCodeImage token={profile.qr_token} size={280} />

        <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
          Présentez ce code au kiosque pour pointer votre arrivée ou départ.
        </p>
      </div>
    </div>
  )
}
