import { Skeleton } from '@/components/ui/skeleton'

// Shape-matched fallback for check-in: header, 3-stat strip, QR scanner
// card (square viewport, primary button, manual entry row).
export default function CheckinLoading() {
  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="space-y-1">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
      <div className="rounded-xl border p-5 flex flex-col items-center gap-3.5">
        <Skeleton className="h-3 w-24 self-start" />
        <Skeleton className="aspect-square w-full max-w-[260px] rounded-xl" />
        <Skeleton className="h-11 w-full max-w-[260px] rounded-lg" />
        <div className="w-full border-t pt-3.5 flex gap-2">
          <Skeleton className="h-9 flex-1 rounded-lg" />
          <Skeleton className="h-9 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
