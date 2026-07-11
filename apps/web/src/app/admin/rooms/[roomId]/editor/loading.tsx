import { Skeleton } from '@/components/ui/skeleton'

// Shape-matched fallback for the seat-map editor: back button + title/counts,
// large square-ish canvas area.
export default function SeatMapEditorLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-24 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>

      <Skeleton className="h-[600px] w-full rounded-xl" />
    </div>
  )
}
