import { createSupabaseClient } from '@/supabase-clients/server'

export type AttendanceExportRow = {
  type: 'attendance' | 'reservation'
  date: string
  studentName: string
  detail: string
}

export async function getAttendanceExport(filters: { from: string; to: string }): Promise<AttendanceExportRow[]> {
  const supabase = await createSupabaseClient()

  const [{ data: attendance }, { data: reservations }] = await Promise.all([
    supabase
      .from('attendance')
      .select('checked_in_at, checked_out_at, entry_method, profiles!attendance_student_id_fkey(full_name)')
      .gte('checked_in_at', filters.from + 'T00:00:00')
      .lte('checked_in_at', filters.to + 'T23:59:59'),
    supabase
      .from('reservations')
      .select('reserved_at, expires_at, status, profiles!reservations_student_id_fkey(full_name)')
      .gte('reserved_at', filters.from + 'T00:00:00')
      .lte('reserved_at', filters.to + 'T23:59:59'),
  ])

  const rows: AttendanceExportRow[] = []

  attendance?.forEach((r) => {
    const profile = r.profiles as unknown as { full_name: string } | null
    const out = r.checked_out_at
      ? new Date(r.checked_out_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : 'en cours'
    rows.push({
      type: 'attendance',
      date: r.checked_in_at,
      studentName: profile?.full_name ?? 'N/A',
      detail: `Entrée ${r.entry_method === 'qr_scan' ? 'QR' : 'manuelle'} — sortie ${out}`,
    })
  })

  reservations?.forEach((r) => {
    const profile = r.profiles as unknown as { full_name: string } | null
    rows.push({
      type: 'reservation',
      date: r.reserved_at,
      studentName: profile?.full_name ?? 'N/A',
      detail: `Statut: ${r.status}`,
    })
  })

  return rows.sort((a, b) => a.date.localeCompare(b.date))
}
