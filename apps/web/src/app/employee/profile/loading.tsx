import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for employee profile: title, centered avatar card,
// info rows card, sign-out button.
export default function ProfileLoading() {
  return (
    <SkeletonGroup className="p-4 pb-24 space-y-4">
      <Skeleton className="h-5 w-28" />
      <div className="rounded-xl border p-5 flex flex-col items-center gap-3">
        <Skeleton className="h-[72px] w-[72px] rounded-full" />
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
      <div className="rounded-lg border divide-y">
        <div className="flex items-center justify-between px-4 py-3">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-28" />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-24" />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-20" />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      </div>
      <Skeleton className="h-11 w-full rounded-lg" />
    </SkeletonGroup>
  )
}
