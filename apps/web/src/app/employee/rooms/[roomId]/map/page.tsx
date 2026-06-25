import { getRoomById } from '@/data/admin/rooms'
import { getSeatMap } from '@/data/admin/seat-map'
import { EmployeeMapClient } from './EmployeeMapClient'
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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/employee/rooms">
            <CaretLeft className="mr-1 h-4 w-4" />
            Salles
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{room.name}</h1>
      </div>

      <EmployeeMapClient room={room} initialTables={tables} initialSeats={seats} />
    </div>
  )
}
