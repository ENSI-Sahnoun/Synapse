import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for settings: header, "Réservations" section (4
// stacked cards), "Navigation" link card, danger-zone section.
export default function AdminSettingsLoading() {
  return (
    <div className="flex max-w-2xl flex-col gap-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-32" />
        <SkeletonGroup className="flex flex-col gap-4">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </SkeletonGroup>
      </div>

      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>

      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  )
}
