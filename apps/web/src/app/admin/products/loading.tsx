import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for products: header + new-product button, search
// bar, category groups each with a row of product cards.
export default function AdminProductsLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>

      <Skeleton className="h-10 w-full max-w-sm rounded-md" />

      <SkeletonGroup className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-28" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>
      </SkeletonGroup>
    </div>
  )
}
