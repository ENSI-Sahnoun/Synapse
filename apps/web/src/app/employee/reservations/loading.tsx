import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for active reservations: header + count, table of
// reservation rows (student, room·seat, reserved/expires, actions).
export default function ReservationsLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3.5 w-32" />
      </div>
      <div className="rounded-xl border overflow-hidden">
        <SkeletonGroup className="divide-y">
          <div className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-20 hidden sm:block" />
            <Skeleton className="h-3.5 w-16 ml-auto" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
          <div className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3.5 w-16 hidden sm:block" />
            <Skeleton className="h-3.5 w-16 ml-auto" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
          <div className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-24 hidden sm:block" />
            <Skeleton className="h-3.5 w-16 ml-auto" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        </SkeletonGroup>
      </div>
    </div>
  )
}
