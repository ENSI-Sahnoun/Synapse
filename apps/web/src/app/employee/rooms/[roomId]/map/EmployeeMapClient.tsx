'use client'

import { useState } from 'react'
import { LiveSeatMap } from '@/components/seat-map/LiveSeatMap'
import { AssignStudentDialog } from '@/components/seat-map/AssignStudentDialog'
import type { Seat, RoomTable } from '@/data/admin/seat-map'
import type { Room } from '@/data/admin/rooms'

type Props = {
  room: Room
  initialTables: RoomTable[]
  initialSeats: Seat[]
}

export function EmployeeMapClient({ room, initialTables, initialSeats }: Props) {
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  function handleSeatClick(seat: Seat) {
    if (seat.status === 'out_of_service') return
    setSelectedSeat(seat)
    setDialogOpen(true)
  }

  return (
    <>
      <LiveSeatMap
        room={room}
        initialTables={initialTables}
        initialSeats={initialSeats}
        mode="employee"
        onSeatClick={handleSeatClick}
      />
      <AssignStudentDialog
        seat={selectedSeat}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  )
}
