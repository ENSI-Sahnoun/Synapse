import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for accounting: header + export/link buttons, date
// range filter, tabs, default "Dépenses" tab (new-expense form card + table).
export default function AccountingLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-44 rounded-md" />
        </div>
      </div>

      <Skeleton className="h-10 w-72 rounded-md" />

      <div className="flex gap-2">
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      <div className="space-y-2 rounded-xl border p-4">
        <Skeleton className="h-5 w-36" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border p-4">
        <Skeleton className="h-5 w-56" />
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
