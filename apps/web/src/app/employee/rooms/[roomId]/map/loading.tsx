import { Skeleton } from '@/components/ui/skeleton'

// Shape-matched fallback for the room seat map: back button + room title,
// large map canvas placeholder.
export default function RoomMapLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-7 w-40" />
      </div>
      <Skeleton className="w-full max-w-[900px] aspect-[3/2] rounded-lg" />
    </div>
  )
}
