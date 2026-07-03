import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { startOfDay } from 'date-fns'
import { Suspense } from 'react'
import { LookupClient } from './LookupClient'

export const dynamic = 'force-dynamic'

export default async function EmployeeStudentsPage() {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [studentsResult, openAttResult, plansResult, roomsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, phone, university, qr_token, student_number')
      .eq('role', 'student')
      .eq('is_archived', false)
      .order('full_name'),
    supabase
      .from('attendance')
      .select('id, student_id, room_id, seat_id, profiles!attendance_student_id_fkey(full_name)')
      .is('checked_out_at', null),
    supabase
      .from('subscription_plans')
      .select('id, name, duration_days, price_dt')
      .eq('is_active', true)
      .order('price_dt'),
    supabase.from('rooms').select('id, name').order('name'),
  ])

  const students = studentsResult.data ?? []
  const openAtt = openAttResult.data ?? []
  const plans = plansResult.data ?? []
  const rooms = roomsResult.data ?? []

  const presentStudentIds = [...new Set(openAtt.map((a) => a.student_id).filter(Boolean))] as string[]
  const subsResult = presentStudentIds.length > 0
    ? await supabase
        .from('subscriptions')
        .select('student_id, end_date, subscription_plans(name)')
        .in('student_id', presentStudentIds)
        .order('end_date', { ascending: false })
    : { data: [] }

  // Pick each present student's most recent subscription, then check it's
  // still active in JS (avoids date/timezone string-comparison pitfalls).
  const today = startOfDay(new Date())
  const planNameByStudent: Record<string, string> = {}
  for (const s of subsResult.data ?? []) {
    if (!s.student_id || planNameByStudent[s.student_id]) continue
    if (new Date(s.end_date) < today) continue
    const name = (s.subscription_plans as { name: string } | null)?.name
    if (name) planNameByStudent[s.student_id] = name
  }

  const roomMap: Record<string, string> = {}
  for (const r of rooms) roomMap[r.id] = r.name

  const seatIds = [...new Set(openAtt.map(a => a.seat_id).filter(Boolean))] as string[]
  const seatsResult = seatIds.length > 0
    ? await supabase.from('seats').select('id, label').in('id', seatIds)
    : { data: [] }
  const seatMap: Record<string, string> = {}
  for (const s of seatsResult.data ?? []) seatMap[s.id] = s.label

  const currentlyIn = openAtt
    .filter((a): a is typeof a & { student_id: string } => a.student_id !== null)
    .map(a => ({
      studentId: a.student_id,
      attendanceId: a.id,
      roomId: a.room_id ?? null,
      roomName: a.room_id ? (roomMap[a.room_id] ?? '—') : '—',
      seatLabel: a.seat_id ? (seatMap[a.seat_id] ?? null) : null,
      planName: planNameByStudent[a.student_id] ?? null,
    }))

  return (
    <div className="p-4 pb-24">
      <Suspense>
        <LookupClient students={students} currentlyIn={currentlyIn} plans={plans} />
      </Suspense>
    </div>
  )
}
