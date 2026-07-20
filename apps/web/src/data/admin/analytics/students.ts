import { createSupabaseClient } from '@/supabase-clients/server'

export type StudentTypePoint = { date: string; nouveaux: number; recurrents: number }

export async function getStudentTypeSeries(range: { from: string; to: string }): Promise<StudentTypePoint[]> {
  const supabase = await createSupabaseClient()

  // Attendance rows with student join to detect new vs returning
  const { data: rows } = await supabase
    .from('attendance')
    .select('checked_in_at, student_id, profiles!inner(created_at)')
    .gte('checked_in_at', range.from + 'T00:00:00')
    .lte('checked_in_at', range.to + 'T23:59:59')

  const newMap = new Map<string, Set<string>>()
  const retMap = new Map<string, Set<string>>()

  rows?.forEach((r) => {
    if (!r.student_id) return
    const checkDate = r.checked_in_at.slice(0, 10)
    // If profile created_at is on same day as check-in → new student
    const profileDate = (r.profiles as { created_at: string }).created_at.slice(0, 10)
    const isNew = profileDate === checkDate
    if (isNew) {
      if (!newMap.has(checkDate)) newMap.set(checkDate, new Set())
      newMap.get(checkDate)!.add(r.student_id)
    } else {
      if (!retMap.has(checkDate)) retMap.set(checkDate, new Set())
      retMap.get(checkDate)!.add(r.student_id)
    }
  })

  const result: StudentTypePoint[] = []
  const cur = new Date(range.from + 'T00:00:00Z')
  const end = new Date(range.to + 'T00:00:00Z')
  while (cur <= end) {
    const key = cur.toISOString().slice(0, 10)
    result.push({
      date: key,
      nouveaux: newMap.get(key)?.size ?? 0,
      recurrents: retMap.get(key)?.size ?? 0,
    })
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return result
}

export type UniversityBreakdown = { university: string; count: number }
export type StudyLevelBreakdown = { studyLevel: string; count: number }
export type TopStudentByLoyalty = { studentId: string; fullName: string; points: number }
export type TopStudentBySpend = { studentId: string; fullName: string; totalSpend: number }

export async function getStudentBreakdown(): Promise<{
  byUniversity: UniversityBreakdown[]
  byStudyLevel: StudyLevelBreakdown[]
}> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('profiles')
    .select('university, study_level')
    .eq('role', 'student')
    .eq('is_archived', false)

  const uniMap = new Map<string, number>()
  const levelMap = new Map<string, number>()
  data?.forEach((r) => {
    const uni = r.university ?? 'Non renseigné'
    const level = r.study_level ?? 'Non renseigné'
    uniMap.set(uni, (uniMap.get(uni) ?? 0) + 1)
    levelMap.set(level, (levelMap.get(level) ?? 0) + 1)
  })

  return {
    byUniversity: Array.from(uniMap.entries())
      .map(([university, count]) => ({ university, count }))
      .sort((a, b) => b.count - a.count),
    byStudyLevel: Array.from(levelMap.entries())
      .map(([studyLevel, count]) => ({ studyLevel, count }))
      .sort((a, b) => b.count - a.count),
  }
}

export async function getTopStudentsByLoyalty(limit = 10): Promise<TopStudentByLoyalty[]> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('loyalty_ledger').select('student_id, points_delta, profiles!inner(full_name)')

  const map = new Map<string, { fullName: string; points: number }>()
  data?.forEach((r) => {
    const fullName = (r.profiles as unknown as { full_name: string }).full_name
    const existing = map.get(r.student_id) ?? { fullName, points: 0 }
    existing.points += Number(r.points_delta)
    map.set(r.student_id, existing)
  })

  return Array.from(map.entries())
    .map(([studentId, v]) => ({ studentId, fullName: v.fullName, points: v.points }))
    .sort((a, b) => b.points - a.points)
    .slice(0, limit)
}

export async function getTopStudentsBySpend(
  range: { from: string; to: string },
  limit = 10,
): Promise<TopStudentBySpend[]> {
  const supabase = await createSupabaseClient()

  const [{ data: subs }, { data: purchases }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('student_id, paid_amount, created_at, profiles!subscriptions_student_id_fkey(full_name)')
      .gte('created_at', range.from + 'T00:00:00')
      .lte('created_at', range.to + 'T23:59:59')
      .is('voided_at', null),
    supabase
      .from('purchases')
      .select('student_id, total_dt, created_at, profiles!purchases_student_id_fkey(full_name)')
      .gte('created_at', range.from + 'T00:00:00')
      .lte('created_at', range.to + 'T23:59:59')
      .not('student_id', 'is', null)
      .is('voided_at', null),
  ])

  const map = new Map<string, { fullName: string; totalSpend: number }>()
  subs?.forEach((r) => {
    const fullName = (r.profiles as unknown as { full_name: string }).full_name
    const existing = map.get(r.student_id) ?? { fullName, totalSpend: 0 }
    existing.totalSpend += Number(r.paid_amount)
    map.set(r.student_id, existing)
  })
  purchases?.forEach((r) => {
    if (!r.student_id) return
    const fullName = (r.profiles as unknown as { full_name: string } | null)?.full_name ?? 'Inconnu'
    const existing = map.get(r.student_id) ?? { fullName, totalSpend: 0 }
    existing.totalSpend += Number(r.total_dt)
    map.set(r.student_id, existing)
  })

  return Array.from(map.entries())
    .map(([studentId, v]) => ({ studentId, fullName: v.fullName, totalSpend: v.totalSpend }))
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, limit)
}
