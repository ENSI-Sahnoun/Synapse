import { Skeleton } from '@/components/ui/skeleton'

// Shape-matched fallback for subscriptions analytics: title, date filter,
// status/discount cards row, plan pie chart + revenue-per-plan table pair.
export default function SubscriptionsAnalyticsLoading() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-8 w-80" />
      <Skeleton className="h-10 w-72 rounded-md" />

      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  )
}
