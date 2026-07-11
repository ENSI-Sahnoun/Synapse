import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for loyalty: header + new-rule button, rules table,
// leaderboard section heading + settings cards.
export default function AdminLoyaltyLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>

      <div className="rounded-md border p-2">
        <SkeletonGroup className="space-y-2">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </SkeletonGroup>
      </div>

      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>

      <SkeletonGroup className="flex flex-col gap-4">
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </SkeletonGroup>
    </div>
  )
}
