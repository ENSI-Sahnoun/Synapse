import { getRooms } from '@/data/admin/rooms'
import { CreateRoomDialog } from './CreateRoomDialog'
import { EditRoomDialog } from './EditRoomDialog'
import { SetRoomStatusDialog } from './SetRoomStatusDialog'
import { DeleteRoomButton } from './DeleteRoomButton'
import { RoomStatusBadge } from './RoomStatusBadge'
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

export default async function AdminRoomsPage() {
  const rooms = await getRooms()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Salles</h1>
          <p className="text-muted-foreground text-sm">
            {rooms.length} salle{rooms.length !== 1 ? 's' : ''} configurée{rooms.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/rooms/floor-plan">
              <GridFour className="mr-1 h-4 w-4" />
              Plan de l&apos;établissement
            </Link>
          </Button>
          <CreateRoomDialog />
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center">
          <p className="text-lg font-medium">Aucune salle</p>
          <p className="text-sm">Créez votre première salle pour commencer.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead className="w-24 text-right">Capacité</TableHead>
                <TableHead className="w-32">Statut</TableHead>
                <TableHead>Note de statut</TableHead>
                <TableHead className="w-44 text-right">Actions</TableHead>
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
                      <Button variant="ghost" size="icon" title="Éditeur de plan" asChild>
                        <Link href={`/admin/rooms/${room.id}/editor`}>
                          <GridFour className="h-4 w-4" />
                        </Link>
                      </Button>
                      <SetRoomStatusDialog room={room} />
                      <EditRoomDialog room={room} />
                      <DeleteRoomButton roomId={room.id} roomName={room.name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
