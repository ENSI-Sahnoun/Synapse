import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { QrCodeImage } from '@/components/student/QrCodeImage'
import { PrintButton } from '@/components/employee/PrintButton'

export default async function AdminPrintQrPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSupabaseClient()

  const { data: viewer } = await supabase.auth.getUser()
  if (!viewer.user) redirect('/login')

  const { data: student } = await supabase
    .from('profiles')
    .select('full_name, qr_token')
    .eq('id', id)
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="text-center">
        <p className="text-lg font-semibold">{student.full_name}</p>
        <p className="text-xs text-muted-foreground">Carte d&apos;accès Synapse</p>
      </div>
      <div className="bg-white p-4 border rounded-xl shadow">
        <QrCodeImage token={student.qr_token} size={220} />
      </div>
      <PrintButton />
    </div>
  )
}
