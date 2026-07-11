import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// /student/reservation immediately redirects to /student/rooms with no data
// fetched first, so this fallback is rarely visible — shape-matched to the
// room list it forwards to: header plus stacked room cards.
export default function StudentReservationLoading() {
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
