import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for the QR page: QR + secret-code card, then the
// "what your QR does" list card (stacked on mobile, two columns on desktop).
export default function StudentQrLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl py-2">
      <SkeletonGroup className="grid gap-6 lg:grid-cols-2">
        {/* Left: QR + secret code */}
        <div className="flex flex-col items-center gap-5 rounded-2xl border p-4 sm:p-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-[280px] w-[280px] max-w-full rounded-2xl" />
          <div className="w-full max-w-xs space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        </div>

        {/* Right: what the QR can do */}
        <div className="flex flex-col gap-4 rounded-2xl border p-6">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-52" />
          </div>
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-10 w-10 flex-shrink-0 rounded-xl" />
                <div className="flex-1 space-y-1.5 pt-0.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
          <Skeleton className="mt-auto h-3 w-3/4" />
        </div>
      </SkeletonGroup>
    </div>
  )
}
