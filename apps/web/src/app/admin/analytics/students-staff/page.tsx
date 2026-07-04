import {
  getStudentTypeSeries,
  getStudentBreakdown,
  getTopStudentsByLoyalty,
  getTopStudentsBySpend,
} from '@/data/admin/analytics/students'
import { getEmployeeRevenue, getShiftsSummary } from '@/data/admin/analytics/staff'
import { StudentTypeChart } from '@/components/admin/dashboard/student-type-chart'
import { StudentBreakdownCards } from '@/components/admin/analytics/student-breakdown-cards'
import { TopStudentsTable } from '@/components/admin/analytics/top-students-table'
import { EmployeeRevenueTable } from '@/components/admin/analytics/employee-revenue-table'
import { DateRangeFilter } from '@/components/admin/shared/date-range-filter'
import { defaultDateRange } from '@/lib/date-range'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = { searchParams: Promise<{ from?: string; to?: string }> }

export default async function StudentsStaffAnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const defaults = defaultDateRange()
  const from = params.from ?? defaults.from
  const to = params.to ?? defaults.to

  const [studentTypeSeries, breakdown, topLoyalty, topSpend, employeeRevenue, shiftsSummary] =
    await Promise.all([
      getStudentTypeSeries({ from, to }),
      getStudentBreakdown(),
      getTopStudentsByLoyalty(),
      getTopStudentsBySpend({ from, to }),
      getEmployeeRevenue({ from, to }),
      getShiftsSummary({ from, to }),
    ])

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Analyse — Étudiants &amp; personnel</h1>
      <DateRangeFilter from={from} to={to} />

      <StudentTypeChart data={studentTypeSeries} />
      <StudentBreakdownCards byUniversity={breakdown.byUniversity} byStudyLevel={breakdown.byStudyLevel} />
      <TopStudentsTable byLoyalty={topLoyalty} bySpend={topSpend} />
      <EmployeeRevenueTable revenue={employeeRevenue} shifts={shiftsSummary} />
    </div>
  )
}
