import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for subscription plans: header + new-plan button,
// plans table rows.
export default function SubscriptionPlansLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>

      <div className="rounded-md border p-2">
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
