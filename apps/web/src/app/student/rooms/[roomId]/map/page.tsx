import { getRoomById } from '@/data/admin/rooms'
import { getSeatMap } from '@/data/admin/seat-map'
import { getMyPresence } from '@/data/student/profile'
import { StudentMapClient } from './StudentMapClient'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CaretLeft } from '@phosphor-icons/react/dist/ssr'

type Props = { params: Promise<{ roomId: string }> }

export default async function StudentSeatMapPage({ params }: Props) {
  const { roomId } = await params
  const [room, { tables, seats }, presence] = await Promise.all([
    getRoomById(roomId),
    getSeatMap(roomId),
    getMyPresence(),
  ])

  if (!room) notFound()

  const mySeatId = presence.status === 'seated' ? presence.seatId : null
  const alreadyCheckedIn = presence.status === 'seated' || presence.status === 'divers'

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/student/rooms">
            <CaretLeft className="mr-1 h-4 w-4" />
            Salles
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">{room.name}</h1>
      </div>
      <StudentMapClient room={room} initialTables={tables} initialSeats={seats} mySeatId={mySeatId} alreadyCheckedIn={alreadyCheckedIn} />
    </div>
  )
}
