'use client'

import { useState } from 'react'
import { LiveSeatMap } from '@/components/seat-map/LiveSeatMapDynamic'
import { ReservationPlaceholderDialog } from '@/components/seat-map/ReservationPlaceholderDialog'
import { SeatSwapRequestDialog } from '@/components/seat-map/SeatSwapRequestDialog'
import { ClaimSeatDialog } from '@/components/seat-map/ClaimSeatDialog'
import { FreeSwapDialog } from '@/components/seat-map/FreeSwapDialog'
import type { Room } from '@/data/admin/rooms'
import type { RoomTable, Seat } from '@/data/admin/seat-map'

type Props = {
  room: Room
  initialTables: RoomTable[]
  initialSeats: Seat[]
  mySeatId?: string | null
  /** Already checked in (seated or Divers) — clicking a free seat requests a swap instead of a reservation */
  alreadyCheckedIn?: boolean
  /** Present but seatless ("Divers") — claiming a free seat is auto-assigned, no staff approval */
  isDivers?: boolean
  /** Admin "free_swap" setting — a seated student may move to a free seat without approval */
  freeSwap?: boolean
}

export function StudentMapClient({ room, initialTables, initialSeats, mySeatId, alreadyCheckedIn, isDivers, freeSwap }: Props) {
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
      {!alreadyCheckedIn ? (
        // Not present yet → reserve the seat for later.
        <ReservationPlaceholderDialog seat={selectedSeat} open={dialogOpen} onOpenChange={setDialogOpen} />
      ) : isDivers ? (
        // Present but seatless → claim the free seat instantly.
        <ClaimSeatDialog seat={selectedSeat} roomId={room.id} open={dialogOpen} onOpenChange={setDialogOpen} />
      ) : freeSwap ? (
        // Seated + free-swap enabled → move to the free seat instantly.
        <FreeSwapDialog seat={selectedSeat} roomId={room.id} open={dialogOpen} onOpenChange={setDialogOpen} />
      ) : (
        // Seated, free-swap off → moving elsewhere needs staff approval.
        <SeatSwapRequestDialog seat={selectedSeat} open={dialogOpen} onOpenChange={setDialogOpen} />
      )}
    </>
  )
}
