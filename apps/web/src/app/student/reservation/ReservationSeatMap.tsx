'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { createReservation } from '@/actions/student/reservations'
import { LiveSeatMap } from '@/components/seat-map/LiveSeatMap'
import { toast } from 'sonner'
import type { Seat } from '@/data/admin/seat-map'
import type { Room } from '@/data/admin/rooms'

type PartialTable = {
  id: string
  position_x: number
  position_y: number
  width: number
  height: number
  rotation: number
  label: string
}

type PartialSeat = {
  id: string
  label: string
  position_x: number
  position_y: number
  rotation: number
  status: string
  table_id: string | null
}

type RoomWithData = {
  id: string
  name: string
  status: string
  status_note: string | null
  tables: PartialTable[]
  seats: PartialSeat[]
}

export function ReservationSeatMap({ rooms }: { rooms: RoomWithData[] }) {
  const [pendingSeat, setPendingSeat] = useState<PartialSeat | null>(null)

  const { execute, status } = useAction(createReservation, {
    onSuccess: ({ data }) => {
      if (data && 'error' in data && data.error) {
        toast.error(data.error)
        setPendingSeat(null)
        return
      }
      toast.success(
        `Place réservée${data && 'holdMinutes' in data ? ` pour ${data.holdMinutes} minutes` : ''}.`,
      )
      setPendingSeat(null)
      window.location.reload()
    },
    onError: () => {
      toast.error('Erreur lors de la réservation. Veuillez réessayer.')
    },
  })

  const isPending = status === 'executing'

  function handleSeatClick(seat: Seat | PartialSeat) {
    if (seat.status !== 'free') return
    setPendingSeat(seat as PartialSeat)
  }

  function handleConfirm() {
    if (!pendingSeat) return
    execute({ seat_id: pendingSeat.id })
  }

  function handleCancel() {
    setPendingSeat(null)
  }

  return (
    <div className="flex flex-col gap-6">
      {rooms.map((room) => {
        const roomData: Room = {
          id: room.id,
          name: room.name,
          status: room.status,
          status_note: room.status_note,
        } as Room

        return (
          <div key={room.id} className="border rounded-xl p-4">
            <LiveSeatMap
              room={roomData}
              initialTables={room.tables as unknown as import('@/data/admin/seat-map').RoomTable[]}
              initialSeats={room.seats as unknown as Seat[]}
              mode="student"
              onSeatClick={handleSeatClick}
            />
          </div>
        )
      })}

      {/* Confirmation bottom sheet */}
      {pendingSeat && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold mb-2">Confirmer la réservation</h3>
            <p className="text-gray-600 mb-4">
              Réserver la place <strong>{pendingSeat.label}</strong> ?
              Votre réservation expirera automatiquement si vous ne vous présentez pas avant la fin
              du délai.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                disabled={isPending}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="flex-1 py-2 rounded-lg bg-green-600 text-white font-medium disabled:opacity-60"
              >
                {isPending ? 'Réservation…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
