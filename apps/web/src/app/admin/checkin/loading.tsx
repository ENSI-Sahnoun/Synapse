import { Skeleton } from '@/components/ui/skeleton'

// Shape-matched fallback for the check-in kiosk: header, 3-up summary strip
// (today / present / left), and the scanner card.
export default function AdminCheckinLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    </div>
  )
}
