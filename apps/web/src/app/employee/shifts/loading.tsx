import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for shifts: title, "Semaine" label, 7 day rows
// (day name + time range or repos).
export default function ShiftsLoading() {
  return (
    <div className="p-4 pb-24 space-y-4">
      <Skeleton className="h-5 w-28" />
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-16" />
        <SkeletonGroup className="space-y-2">
          <div className="rounded-lg border p-3.5 flex items-center justify-between">
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <div className="rounded-lg border p-3.5 flex items-center justify-between">
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <div className="rounded-lg border p-3.5 flex items-center justify-between">
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-3.5 w-16" />
          </div>
          <div className="rounded-lg border p-3.5 flex items-center justify-between">
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <div className="rounded-lg border p-3.5 flex items-center justify-between">
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-3.5 w-16" />
          </div>
          <div className="rounded-lg border p-3.5 flex items-center justify-between">
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-3.5 w-16" />
          </div>
          <div className="rounded-lg border p-3.5 flex items-center justify-between">
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        </SkeletonGroup>
      </div>
    </div>
  )
}
