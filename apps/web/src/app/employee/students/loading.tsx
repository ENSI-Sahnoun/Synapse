import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for student lookup: search input, section label,
// list of student cards (avatar, name, presence line).
export default function StudentsLoading() {
  return (
    <div className="p-4 pb-24 space-y-4">
      <Skeleton className="h-11 w-full rounded-lg" />
      <Skeleton className="h-3.5 w-40" />
      <SkeletonGroup className="space-y-2">
        <div className="rounded-lg border p-3 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="rounded-lg border p-3 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="rounded-lg border p-3 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="rounded-lg border p-3 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <div className="rounded-lg border p-3 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </SkeletonGroup>
    </div>
  )
}
