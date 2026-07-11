import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// /student/loyalty immediately redirects to /student/rewards with no data
// fetched first, so this fallback is rarely visible — shape-matched to the
// rewards hub it forwards to: points hero, tab bar, panel body.
export default function StudentLoyaltyLoading() {
  return (
    <SkeletonGroup className="space-y-4">
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </SkeletonGroup>
  )
}
