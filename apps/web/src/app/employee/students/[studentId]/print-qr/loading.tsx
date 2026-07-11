import { Skeleton } from '@/components/ui/skeleton'

// Shape-matched fallback for the printable QR card: name/subtitle, QR
// square, print button.
export default function PrintQrLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6">
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-[220px] w-[220px] rounded-xl" />
      <Skeleton className="h-10 w-32 rounded-md" />
    </div>
  )
}
