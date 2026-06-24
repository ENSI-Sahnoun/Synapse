import { getRoomById } from '@/data/admin/rooms'
import { getSeatsByRoom } from '@/data/seats'
import { EditorCanvas } from './EditorCanvas'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CaretLeft } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/button'

type Props = { params: Promise<{ roomId: string }> }

export default async function SeatMapEditorPage({ params }: Props) {
  const { roomId } = await params
  const [room, seats] = await Promise.all([
    getRoomById(roomId),
    getSeatsByRoom(roomId),
  ])

  if (!room) notFound()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/rooms">
            <CaretLeft className="mr-1 h-4 w-4" />
            Salles
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Éditeur — {room.name}</h1>
          <p className="text-muted-foreground text-sm">
            Capacité déclarée : {room.capacity} places · {seats.length} place
            {seats.length !== 1 ? 's' : ''} positionnée{seats.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <EditorCanvas roomId={room.id} initialSeats={seats} />
    </div>
  )
}
