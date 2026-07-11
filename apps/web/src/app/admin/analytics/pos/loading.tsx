import { Skeleton } from '@/components/ui/skeleton'

// Shape-matched fallback for POS analytics: title, date filter, best-sellers
// + category chart pair, margin table card, stock snapshot + restock pair.
export default function PosAnalyticsLoading() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-8 w-96" />
      <Skeleton className="h-10 w-72 rounded-md" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>

      <Skeleton className="h-72 w-full rounded-xl" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  )
}
