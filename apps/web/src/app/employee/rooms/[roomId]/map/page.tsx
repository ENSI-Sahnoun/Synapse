import { getRoomById } from '@/data/admin/rooms'
import { getSeatMap } from '@/data/admin/seat-map'
import { RoomMap } from './RoomMap'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CaretLeft } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/button'

type Props = { params: Promise<{ roomId: string }> }

export default async function RoomMapPage({ params }: Props) {
  const { roomId } = await params
  const [room, { tables, seats }] = await Promise.all([
    getRoomById(roomId),
    getSeatMap(roomId),
  ])

  if (!room) notFound()

  const freeCount = seats.filter((s) => s.status === 'free').length
  const placesLabel = freeCount !== 1 ? `${freeCount} places disponibles` : `${freeCount} place disponible`

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/employee/rooms">
            <CaretLeft className="mr-1 h-4 w-4" />
            Salles
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{room.name}</h1>
          <p className="text-muted-foreground text-sm">{placesLabel}</p>
        </div>
      </div>

      <RoomMap tables={tables} seats={seats} />

      <div className="flex gap-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-blue-500" />
          Libre
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
          Occupée
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
          Ma place
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-gray-400" />
          Hors service
        </span>
      </div>
    </div>
  )
}
