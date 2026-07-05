import { Skeleton } from '@/components/ui/skeleton'

// Instant Suspense fallback for employee routes while server data resolves.
export default function EmployeeLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
