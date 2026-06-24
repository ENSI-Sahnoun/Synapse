import { getRooms } from '@/data/admin/rooms'
import { SetRoomStatusDialog } from '@/app/admin/rooms/SetRoomStatusDialog'
import { RoomStatusBadge } from '@/app/admin/rooms/RoomStatusBadge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { GridFour } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'

export default async function EmployeeRoomsPage() {
  const rooms = await getRooms()

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Salles</h1>
        <p className="text-muted-foreground text-sm">
          Consultez le statut des salles et modifiez-le si nécessaire.
        </p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead className="w-24 text-right">Capacité</TableHead>
              <TableHead className="w-32">Statut</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map((room) => (
              <TableRow key={room.id}>
                <TableCell className="font-medium">{room.name}</TableCell>
                <TableCell className="text-right">{room.capacity}</TableCell>
                <TableCell>
                  <RoomStatusBadge status={room.status as 'open' | 'closed' | 'reserved'} />
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {room.status_note ?? '—'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" title="Plan de salle" asChild>
                      <Link href={`/employee/rooms/${room.id}/map`}>
                        <GridFour className="h-4 w-4" />
                      </Link>
                    </Button>
                    <SetRoomStatusDialog room={room} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
