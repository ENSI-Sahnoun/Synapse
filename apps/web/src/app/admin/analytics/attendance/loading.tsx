import { Skeleton } from '@/components/ui/skeleton'

// Shape-matched fallback for attendance analytics: title, date filter,
// 3-up stat cards (occupancy / avg session / entry method), heatmap block.
export default function AttendanceAnalyticsLoading() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-8 w-96" />
      <Skeleton className="h-10 w-72 rounded-md" />

      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  )
}
