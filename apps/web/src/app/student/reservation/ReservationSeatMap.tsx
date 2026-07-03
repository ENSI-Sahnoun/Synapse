'use client'

import { useState, useEffect } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { createClient } from '@/supabase-clients/client'
import { createReservation } from '@/actions/student/reservations'
import { requestSeatSwap } from '@/actions/student/seat-swap'
import { LiveSeatMap } from '@/components/seat-map/LiveSeatMap'
import { toast } from 'sonner'
import type { Seat } from '@/data/admin/seat-map'
import type { Room } from '@/data/admin/rooms'

type PartialTable = {
  id: string
  room_id: string
  position_x: number
  position_y: number
  width: number
  height: number
  rotation: number
  label: string
  status: string
  created_at: string
}

type PartialSeat = {
  id: string
  label: string
  position_x: number
  position_y: number
  rotation: number
  status: string
  table_id: string | null
  room_id: string
}

type RoomWithData = {
  id: string
  name: string
  status: string
  status_note: string | null
  tables: PartialTable[]
  seats: PartialSeat[]
}

export function ReservationSeatMap({
  rooms,
  mySeatId,
  alreadyCheckedIn,
}: {
  rooms: RoomWithData[]
  mySeatId?: string | null
  alreadyCheckedIn?: boolean
}) {
  const [pendingSeat, setPendingSeat] = useState<PartialSeat | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('reservation-page-seats')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'seats' }, (payload) => {
        const updated = payload.new as { id: string; status: string }
        // If the pending seat was just taken, clear it (LiveSeatMap handles its own display state)
        setPendingSeat((prev) => (prev?.id === updated.id && updated.status !== 'free' ? null : prev))
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [])

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

  const { execute: executeSwap, status: swapStatus } = useAction(requestSeatSwap, {
    onSuccess: () => {
      toast.success('Demande envoyée — en attente de validation par un employé.')
      setPendingSeat(null)
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur lors de la demande.'),
  })

  const isPending = status === 'executing' || swapStatus === 'executing'

  function handleSeatClick(seat: Seat | PartialSeat) {
    if (seat.status !== 'free') return
    setPendingSeat(seat as PartialSeat)
  }

  function handleConfirm() {
    if (!pendingSeat) return
    if (alreadyCheckedIn) {
      executeSwap({ toSeatId: pendingSeat.id })
    } else {
      execute({ seat_id: pendingSeat.id })
    }
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

        const isMyRoom = room.seats.some((s) => s.id === mySeatId)

        return (
          <div key={room.id} className={`border rounded-xl p-4 ${isMyRoom ? 'ring-2 ring-green-500' : ''}`}>
            {isMyRoom && (
              <p className="mb-2 text-xs font-semibold text-green-600">Vous êtes dans cette salle</p>
            )}
            <LiveSeatMap
              room={roomData}
              initialTables={room.tables as import('@/data/admin/seat-map').RoomTable[]}
              initialSeats={room.seats as Seat[]}
              mode="student"
              onSeatClick={handleSeatClick}
              highlightSeatId={mySeatId}
              allowFullscreen
            />
          </div>
        )
      })}

      {/* Confirmation bottom sheet */}
      {pendingSeat && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold mb-2">{alreadyCheckedIn ? 'Demander ce changement' : 'Confirmer la réservation'}</h3>
            <p className="text-gray-600 mb-4">
              {alreadyCheckedIn ? (
                <>Demander la place <strong>{pendingSeat.label}</strong> ? Un employé doit valider ce changement avant qu&apos;il ne prenne effet.</>
              ) : (
                <>
                  Réserver la place <strong>{pendingSeat.label}</strong> ?
                  Votre réservation expirera automatiquement si vous ne vous présentez pas avant la fin
                  du délai.
                </>
              )}
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
                {isPending ? 'Envoi…' : alreadyCheckedIn ? 'Demander' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
