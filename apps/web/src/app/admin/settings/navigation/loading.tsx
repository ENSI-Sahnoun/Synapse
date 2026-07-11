import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for nav settings: header, two editor cards
// (employee / admin) each with a title, description, and a list of items.
export default function NavigationSettingsLoading() {
  return (
    <div className="max-w-2xl space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      <SkeletonGroup className="space-y-6">
        <div className="space-y-3 rounded-xl border p-4">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-72" />
          <div className="space-y-1.5 pt-2">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
        <div className="space-y-3 rounded-xl border p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-80" />
          <div className="space-y-1.5 pt-2">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      </SkeletonGroup>
    </div>
  )
}
