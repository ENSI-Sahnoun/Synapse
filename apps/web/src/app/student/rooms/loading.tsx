import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for the room list: header plus stacked room cards.
export default function StudentRoomsLoading() {
  return (
    <div style={{ padding: '20px 16px' }}>
      <Skeleton className="h-6 w-40 mb-4" />
      <SkeletonGroup className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </SkeletonGroup>
    </div>
  )
}
