import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for the reservation page: title, banner, seat map grid.
export default function StudentReservationLoading() {
  return (
    <SkeletonGroup className="flex flex-col gap-4 p-4 max-w-5xl mx-auto">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </SkeletonGroup>
  )
}
