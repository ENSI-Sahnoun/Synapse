import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { QrCodeImage } from '@/components/student/QrCodeImage'
import { FullscreenButton } from '@/components/student/FullscreenButton'
import { SecretCodeReveal } from '@/components/student/SecretCodeReveal'

export const metadata = {
  title: 'Mon QR Code — Synapse',
}

export default async function StudentQrPage() {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, qr_token, student_number')
    .eq('id', user.id)
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Mon QR Code</h1>
        <p className="text-sm text-muted-foreground mt-1">{profile.full_name}</p>
        {profile.student_number && (
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            #{profile.student_number}
          </p>
        )}
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-lg">
        <QrCodeImage token={profile.qr_token} size={260} />
      </div>

      <p className="text-xs text-muted-foreground text-center max-w-xs">
        Présentez ce code à l&apos;employé ou devant le kiosque à l&apos;entrée.
      </p>

      <SecretCodeReveal token={profile.qr_token} />

      <FullscreenButton />
    </div>
  )
}
