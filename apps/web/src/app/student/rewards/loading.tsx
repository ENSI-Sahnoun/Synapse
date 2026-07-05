import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for the rewards hub: points hero, tab bar, panel body.
export default function StudentRewardsLoading() {
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
