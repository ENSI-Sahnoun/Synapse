import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for the employee dashboard landing page: greeting,
// KPI card row, quick links.
export default function EmployeeDashboardLoading() {
  return (
    <SkeletonGroup className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
    </SkeletonGroup>
  )
}
