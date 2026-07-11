import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for loyalty requests: header, pending-requests list
// (name/reward/points + action buttons), recent-handled divide-y list.
export default function LoyaltyRequestsLoading() {
  return (
    <div className="p-4 space-y-8 pb-24">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <SkeletonGroup className="space-y-3">
          <div className="rounded-lg border p-4 flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
          <div className="rounded-lg border p-4 flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3.5 w-44" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </SkeletonGroup>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <div className="rounded-lg border">
          <SkeletonGroup className="divide-y">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-36" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </SkeletonGroup>
        </div>
      </div>
    </div>
  )
}
