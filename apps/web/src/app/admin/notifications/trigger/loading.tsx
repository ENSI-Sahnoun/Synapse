import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'

// Shape-matched fallback for notifications: header, channel-config table
// (type rows x email/sms/whatsapp/inapp columns), env-var note, trigger card.
export default function NotificationsTriggerLoading() {
  return (
    <div className="max-w-3xl space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-6 w-56" />
        <div className="overflow-hidden rounded-lg border">
          <SkeletonGroup className="space-y-px">
            <Skeleton className="h-12 w-full rounded-none" />
            <Skeleton className="h-12 w-full rounded-none" />
            <Skeleton className="h-12 w-full rounded-none" />
            <Skeleton className="h-12 w-full rounded-none" />
            <Skeleton className="h-12 w-full rounded-none" />
            <Skeleton className="h-12 w-full rounded-none" />
          </SkeletonGroup>
        </div>
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    </div>
  )
}
