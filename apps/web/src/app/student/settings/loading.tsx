import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for student settings: title, profile card,
// notification/leaderboard toggle rows, collapsed email/password rows,
// sign-out button.
export default function StudentSettingsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-32" />

      {/* Profile card */}
      <div className="rounded-xl border p-5 flex items-center gap-4">
        <Skeleton className="h-[52px] w-[52px] flex-shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3.5 w-44" />
        </div>
      </div>

      <SkeletonGroup className="space-y-4">
        {/* Notification toggles: push + email digest */}
        <div className="rounded-xl border overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <Skeleton className="h-9 w-9 flex-shrink-0 rounded-[10px]" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-5 w-9 flex-shrink-0 rounded-full" />
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-9 w-9 flex-shrink-0 rounded-[10px]" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-5 w-9 flex-shrink-0 rounded-full" />
          </div>
        </div>

        {/* Leaderboard opt-out */}
        <div className="rounded-xl border p-4 flex items-center gap-3">
          <Skeleton className="h-9 w-9 flex-shrink-0 rounded-[10px]" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3 w-full max-w-[220px]" />
          </div>
          <Skeleton className="h-5 w-9 flex-shrink-0 rounded-full" />
        </div>

        {/* Change email (collapsed) */}
        <div className="rounded-xl border p-4 flex items-center gap-3">
          <Skeleton className="h-9 w-9 flex-shrink-0 rounded-[10px]" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-4 w-4 flex-shrink-0 rounded-full" />
        </div>

        {/* Change password (collapsed) */}
        <div className="rounded-xl border p-4 flex items-center gap-3">
          <Skeleton className="h-9 w-9 flex-shrink-0 rounded-[10px]" />
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="ml-auto h-4 w-4 flex-shrink-0 rounded-full" />
        </div>
      </SkeletonGroup>

      {/* Sign out */}
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  )
}
