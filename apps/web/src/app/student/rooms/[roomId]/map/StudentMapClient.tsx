'use client'

import { useState } from 'react'
import { LiveSeatMap } from '@/components/seat-map/LiveSeatMap'
import { ReservationPlaceholderDialog } from '@/components/seat-map/ReservationPlaceholderDialog'
import { SeatSwapRequestDialog } from '@/components/seat-map/SeatSwapRequestDialog'
import type { Room } from '@/data/admin/rooms'
import type { RoomTable, Seat } from '@/data/admin/seat-map'

type Props = {
  room: Room
  initialTables: RoomTable[]
  initialSeats: Seat[]
  mySeatId?: string | null
  /** Already checked in (seated or Divers) — clicking a free seat requests a swap instead of a reservation */
  alreadyCheckedIn?: boolean
}

export function StudentMapClient({ room, initialTables, initialSeats, mySeatId, alreadyCheckedIn }: Props) {
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
        highlightSeatId={mySeatId}
        allowFullscreen
        hideRoomName
      />
      {alreadyCheckedIn ? (
        <SeatSwapRequestDialog seat={selectedSeat} open={dialogOpen} onOpenChange={setDialogOpen} />
      ) : (
        <ReservationPlaceholderDialog seat={selectedSeat} open={dialogOpen} onOpenChange={setDialogOpen} />
      )}
    </>
  )
}
