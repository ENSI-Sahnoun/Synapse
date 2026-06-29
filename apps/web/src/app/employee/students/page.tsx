import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { startOfDay } from 'date-fns'
import { LookupClient } from './LookupClient'

export const dynamic = 'force-dynamic'

export default async function EmployeeStudentsPage() {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const todayISO = startOfDay(new Date()).toISOString()
  void todayISO

  const [studentsResult, openAttResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, phone, university, qr_token, student_number')
      .eq('role', 'student')
      .eq('is_archived', false)
      .order('full_name'),
    supabase
      .from('attendance')
      .select('id, student_id, room_id, profiles!attendance_student_id_fkey(full_name)')
      .is('checked_out_at', null),
  ])

  const students = studentsResult.data ?? []
  const openAtt = openAttResult.data ?? []

  const roomIds = [...new Set(openAtt.map(a => a.room_id).filter(Boolean))] as string[]
  const roomsResult = roomIds.length > 0
    ? await supabase.from('rooms').select('id, name').in('id', roomIds)
    : { data: [] }
  const roomMap: Record<string, string> = {}
  for (const r of roomsResult.data ?? []) roomMap[r.id] = r.name

  const currentlyIn = openAtt.map(a => ({
    studentId: a.student_id,
    attendanceId: a.id,
    roomName: a.room_id ? (roomMap[a.room_id] ?? '—') : '—',
  }))

  return (
    <div className="p-4 pb-24">
      <LookupClient students={students} currentlyIn={currentlyIn} />
    </div>
  )
}
