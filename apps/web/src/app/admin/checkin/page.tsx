import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { CheckinClient } from '@/app/employee/checkin/CheckinClient'

export const metadata = { title: "Contrôle d'accès — Synapse" }

export default async function AdminCheckinPage() {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: openRows } = await supabase
    .from('attendance')
    .select('id, checked_in_at, profiles!attendance_student_id_fkey(full_name)')
    .is('checked_out_at', null)
    .order('checked_in_at', { ascending: false })

  const openAttendance = (openRows ?? []).map((row) => ({
    id: row.id,
    studentName: (row as any).profiles?.full_name ?? 'Inconnu',
    checkedInAt: row.checked_in_at,
  }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Contrôle d&apos;accès</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Scannez le QR code d&apos;un étudiant pour valider son entrée.
        </p>
      </div>
      <CheckinClient initialOpenAttendance={openAttendance} />
    </div>
  )
}
