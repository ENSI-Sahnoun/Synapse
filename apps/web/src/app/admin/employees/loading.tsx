import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for employees: kiosk-setup notice banner, header +
// new-employee button, employee table rows.
export default function AdminEmployeesLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="mb-6 h-16 w-full rounded-lg" />

      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
      </div>

      <div className="rounded-md border p-2">
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
