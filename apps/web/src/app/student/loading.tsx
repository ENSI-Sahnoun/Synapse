import { Skeleton } from '@/components/ui/skeleton'

// Instant Suspense fallback shown while a student route's server component
// resolves its data. Without this, navigation blocks with no visual feedback
// until every query finishes — which reads as lag on mobile.
export default function StudentLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  )
}
