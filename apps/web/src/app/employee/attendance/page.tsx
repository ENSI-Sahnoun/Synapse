import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { format, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AttendanceClient } from './AttendanceClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function EmployeeAttendancePage() {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const todayStr = startOfDay(new Date()).toISOString()

  const { data: rows } = await supabase
    .from('attendance')
    .select(`
      id,
      student_id,
      checked_in_at,
      checked_out_at,
      room_id,
      seat_id,
      profiles!attendance_student_id_fkey ( full_name )
    `)
    .gte('checked_in_at', todayStr)
    .order('checked_in_at', { ascending: false })

  // Resolve room names (no FK on attendance.room_id)
  const roomIds = [...new Set((rows ?? []).map((r) => r.room_id).filter(Boolean))] as string[]
  let roomMap: Record<string, string> = {}
  if (roomIds.length > 0) {
    const { data: rooms } = await supabase.from('rooms').select('id, name').in('id', roomIds)
    roomMap = Object.fromEntries((rooms ?? []).map((r) => [r.id, r.name]))
  }

  const seatIds = [...new Set((rows ?? []).map((r) => r.seat_id).filter(Boolean))] as string[]
  let seatMap: Record<string, string> = {}
  if (seatIds.length > 0) {
    const { data: seats } = await supabase.from('seats').select('id, label').in('id', seatIds)
    seatMap = Object.fromEntries((seats ?? []).map((s) => [s.id, s.label]))
  }

  const sessions = (rows ?? []).map((row) => ({
    id: row.id,
    studentId: row.student_id,
    studentName: (row as any).profiles?.full_name ?? 'Inconnu',
    room: row.room_id ? (roomMap[row.room_id] ?? 'Salle Inconnue') : 'Divers',
    seatLabel: row.seat_id ? (seatMap[row.seat_id] ?? null) : null,
    checkedInAt: row.checked_in_at,
    checkedOutAt: row.checked_out_at ?? null,
    status: (row.checked_out_at ? 'out' : 'in') as 'in' | 'out',
  }))

  return (
    <div className="p-4 space-y-4 pb-24">
      <div>
        <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          Présences du jour
        </h1>
        <p className="text-sm capitalize" style={{ color: 'var(--muted-foreground)' }}>
          {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
        </p>
      </div>
      <AttendanceClient sessions={sessions} />
    </div>
  )
}
