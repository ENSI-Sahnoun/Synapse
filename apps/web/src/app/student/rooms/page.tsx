import { getRoomsWithSeatCounts } from '@/data/admin/rooms'
import { CapacityBadge } from '@/components/seat-map/CapacityBadge'
import Link from 'next/link'
import { CaretRight } from '@phosphor-icons/react/dist/ssr'

function RoomStatusIndicator({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    open: { label: 'Ouverte', className: 'bg-green-100 text-green-800' },
    closed: { label: 'Fermée', className: 'bg-red-100 text-red-800' },
    reserved: { label: 'Réservée', className: 'bg-yellow-100 text-yellow-800' },
  }
  const config = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-700' }
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}

export default async function StudentRoomsPage() {
  const rooms = await getRoomsWithSeatCounts()

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Salles disponibles</h1>

      <ul className="space-y-2">
        {rooms.map((room) => (
          <li key={room.id}>
            <Link
              href={`/student/rooms/${room.id}/map`}
              className="flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="space-y-1">
                <p className="font-medium">{room.name}</p>
                <div className="flex items-center gap-2">
                  <RoomStatusIndicator status={room.status ?? 'closed'} />
                  {room.status === 'open' && (
                    <CapacityBadge
                      occupiedCount={room.occupied_count}
                      totalSeats={room.seat_count}
                      showCount
                    />
                  )}
                </div>
                {room.status_note && (
                  <p className="text-muted-foreground text-xs">{room.status_note}</p>
                )}
              </div>
              <CaretRight className="text-muted-foreground h-5 w-5 flex-shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
