import { Skeleton } from '@/components/ui/skeleton'

// Shape-matched fallback for custom metrics: header, new-metric form card
// (2-col fields), existing-metrics table card.
export default function CustomMetricsLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="space-y-4 rounded-xl border p-4">
        <Skeleton className="h-5 w-40" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-9 w-32 self-end rounded-md" />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border p-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-40 w-full rounded-md" />
      </div>
    </div>
  )
}
