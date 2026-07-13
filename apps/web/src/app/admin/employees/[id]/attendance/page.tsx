import { getProfileById } from '@/data/admin/students'
import { createSupabaseClient } from '@/supabase-clients/server'
import { EmployeeAttendanceTable, type AttendanceRow } from '@/components/admin/EmployeeAttendanceTable'
import { EmployeeAttendanceHeatmap, type DayHours } from '@/components/admin/EmployeeAttendanceHeatmap'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format, parseISO, differenceInMinutes, subDays } from 'date-fns'

const LATE_GRACE_MINUTES = 60

export default async function AdminEmployeeAttendancePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const profile = await getProfileById(id).catch(() => null)
  if (!profile || profile.role !== 'employee') notFound()

  const supabase = await createSupabaseClient()

  const since = subDays(new Date(), 182).toISOString()
  const [{ data: attendance }, { data: schedule }] = await Promise.all([
    supabase
      .from('employee_attendance')
      .select('id, clock_in, clock_out, entry_method')
      .eq('employee_id', id)
      .gte('clock_in', since)
      .order('clock_in', { ascending: false }),
    supabase
      .from('weekly_schedules')
      .select('day_of_week, start_time')
      .eq('employee_id', id),
  ])

  const scheduleByDow = new Map((schedule ?? []).map((s) => [s.day_of_week, s.start_time]))

  const rows: AttendanceRow[] = (attendance ?? []).map((a) => {
    const clockIn = parseISO(a.clock_in)
    const dow = (clockIn.getDay() + 6) % 7 // JS 0=Sun -> 0=Mon..6=Sun
    const expectedStart = scheduleByDow.get(dow)

    let status: AttendanceRow['status'] = null
    if (expectedStart) {
      const [h, m] = expectedStart.split(':').map(Number)
      const expected = new Date(clockIn)
      expected.setHours(h, m, 0, 0)
      const lateBy = differenceInMinutes(clockIn, expected)
      status = lateBy > LATE_GRACE_MINUTES ? 'late' : 'present'
    }

    return {
      id: a.id,
      clock_in: a.clock_in,
      clock_out: a.clock_out,
      entry_method: a.entry_method,
      status,
    }
  })

  // Days with a schedule but no clock-in at all today or in the past → absent.
  const today = new Date()
  const todayDow = (today.getDay() + 6) % 7
  const hasOpenOrTodayClockIn = (attendance ?? []).some(
    (a) => format(parseISO(a.clock_in), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
  )
  const isAbsentToday = scheduleByDow.has(todayDow) && !hasOpenOrTodayClockIn

  const hoursByDate = new Map<string, number>()
  for (const a of attendance ?? []) {
    if (!a.clock_out) continue
    const key = format(parseISO(a.clock_in), 'yyyy-MM-dd')
    const hours = differenceInMinutes(parseISO(a.clock_out), parseISO(a.clock_in)) / 60
    hoursByDate.set(key, (hoursByDate.get(key) ?? 0) + hours)
  }
  const daily: DayHours[] = [...hoursByDate.entries()].map(([date, hours]) => ({ date, hours }))

  return (
    <div className="space-y-4">
      <Link href={`/admin/employees/${id}/edit`} className="text-sm text-muted-foreground hover:underline">
        ← {profile.full_name}
      </Link>
      <h1 className="text-2xl font-semibold">Pointage — {profile.full_name}</h1>

      {isAbsentToday && (
        <div
          className="rounded-lg px-4 py-2 text-sm font-semibold"
          style={{ background: 'var(--destructive)', color: '#fff', width: 'fit-content' }}
        >
          Absent aujourd&apos;hui
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-2">Assiduité (6 derniers mois)</h2>
        <EmployeeAttendanceHeatmap daily={daily} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Historique des pointages</h2>
        <EmployeeAttendanceTable employeeId={id} rows={rows} />
      </div>
    </div>
  )
}
