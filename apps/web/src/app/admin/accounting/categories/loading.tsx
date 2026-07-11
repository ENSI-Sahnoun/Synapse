import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for account categories: header + description +
// back/new buttons, single card with the category table.
export default function AccountCategoriesLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-48 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border p-4">
        <Skeleton className="h-5 w-32" />
        <SkeletonGroup className="space-y-2">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </SkeletonGroup>
      </div>
    </div>
  )
}
