import { Skeleton } from '@/components/ui/skeleton'

// Shape-matched fallback for the reports dashboard: title, 2x2 stat grid
// (one cell empty in the real page), hourly bar-chart card, export button.
export default function ReportsLoading() {
  return (
    <div className="p-4 pb-24 space-y-4">
      <Skeleton className="h-5 w-40" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <div />
      </div>
      <div className="rounded-xl border p-4 space-y-3">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-20 w-full rounded-md" />
      </div>
      <Skeleton className="h-11 w-full rounded-lg" />
    </div>
  )
}
