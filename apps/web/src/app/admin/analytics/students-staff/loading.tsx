import { Skeleton } from '@/components/ui/skeleton'

// Shape-matched fallback for students & staff analytics: title, date filter,
// student-type chart, breakdown cards, top-students table, employee revenue table.
export default function StudentsStaffAnalyticsLoading() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-8 w-96" />
      <Skeleton className="h-10 w-72 rounded-md" />

      <Skeleton className="h-72 w-full rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
