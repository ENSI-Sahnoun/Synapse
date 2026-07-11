import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for rooms: header + count + new-room button,
// rooms table rows.
export default function AdminRoomsLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>

      <div className="rounded-lg border p-2">
        <SkeletonGroup className="space-y-2">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </SkeletonGroup>
      </div>
    </div>
  )
}
