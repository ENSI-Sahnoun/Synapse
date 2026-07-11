import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for employee announcements: header + publish
// button, list of announcement cards (title, two-line body, timestamp).
export default function AnnouncementsLoading() {
  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <SkeletonGroup className="space-y-3">
        <div className="rounded-lg border p-4 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="rounded-lg border p-4 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="rounded-lg border p-4 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-20" />
        </div>
      </SkeletonGroup>
    </div>
  )
}
