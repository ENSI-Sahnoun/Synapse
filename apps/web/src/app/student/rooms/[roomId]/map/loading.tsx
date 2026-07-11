import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for the seat map: back-button/room-name header,
// then the fixed-aspect (900x600) seat canvas.
export default function StudentSeatMapLoading() {
  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-6 w-36" />
      </div>
      <SkeletonGroup>
        <Skeleton className="aspect-[3/2] w-full rounded-2xl" />
      </SkeletonGroup>
    </div>
  )
}
