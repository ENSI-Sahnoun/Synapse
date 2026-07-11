import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for POS: sticky cash-session bar, search input,
// category header + product grid (cart starts empty, so omitted here).
export default function PosLoading() {
  return (
    <div className="p-4 pb-24 space-y-4">
      <Skeleton className="h-11 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <SkeletonGroup className="grid grid-cols-3 gap-2.5">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </SkeletonGroup>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-28" />
        <div className="grid grid-cols-3 gap-2.5">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
