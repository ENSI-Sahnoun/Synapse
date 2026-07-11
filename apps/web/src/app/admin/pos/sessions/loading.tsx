import { Skeleton } from '@/components/ui/skeleton'

// Shape-matched fallback for cash sessions: title, date filter, 3-up summary
// cards (current session / today's discrepancy / weekly discrepancies), history table.
export default function CashSessionsLoading() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-72 rounded-md" />

      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  )
}
