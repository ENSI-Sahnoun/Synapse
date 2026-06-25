'use client'

import { useState } from 'react'
import { LiveSeatMap } from '@/components/seat-map/LiveSeatMap'
import { ReservationPlaceholderDialog } from '@/components/seat-map/ReservationPlaceholderDialog'
import type { Room } from '@/data/admin/rooms'
import type { RoomTable, Seat } from '@/data/admin/seat-map'

type Props = {
  room: Room
  initialTables: RoomTable[]
  initialSeats: Seat[]
}

export function StudentMapClient({ room, initialTables, initialSeats }: Props) {
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  function handleSeatClick(seat: Seat) {
    setSelectedSeat(seat)
    setDialogOpen(true)
  }

  return (
    <>
      <LiveSeatMap
        room={room}
        initialTables={initialTables}
        initialSeats={initialSeats}
        mode="student"
        onSeatClick={handleSeatClick}
      />
      <ReservationPlaceholderDialog
        seat={selectedSeat}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  )
}
