import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { getCachedLoggedInUserIdOrNull } from '@/rsc-data/supabase'
import { QrCodeImage } from '@/components/student/QrCodeImage'
import { PrintButton } from '@/components/employee/PrintButton'
import { DropToKioskButton } from '@/components/employee/DropToKioskButton'

interface PrintQrPageProps {
  params: Promise<{ studentId: string }>
}

export default async function PrintQrPage({ params }: PrintQrPageProps) {
  const { studentId } = await params
  const supabase = await createSupabaseClient()

  const viewerId = await getCachedLoggedInUserIdOrNull()
  if (!viewerId) redirect('/login')

  const { data: viewerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', viewerId)
    .single()

  if (!viewerProfile || !['admin', 'employee'].includes(viewerProfile.role)) {
    redirect('/login')
  }

  const { data: student } = await supabase
    .from('profiles')
    .select('full_name, qr_token')
    .eq('id', studentId)
    .eq('role', 'student')
    .single()

  if (!student || !student.qr_token) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">Étudiant introuvable ou token QR non disponible.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6">
      <div className="text-center">
        <p className="text-lg font-semibold">{student.full_name}</p>
        <p className="text-xs text-muted-foreground">Carte d&apos;accès Synapse</p>
      </div>

      <div className="bg-white p-4 border rounded-xl shadow">
        <QrCodeImage token={student.qr_token} size={220} />
      </div>

      <div className="flex gap-3 print:hidden">
        <PrintButton />
        <DropToKioskButton studentId={studentId} />
      </div>
    </div>
  )
}
