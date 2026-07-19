'use client'

import { useState, useEffect, useRef } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { LiveSeatMap } from '@/components/seat-map/LiveSeatMapDynamic'
import {
  assignSeatAction,
  changeSeatAction,
  kioskCheckinSeatlessAction,
} from '@/actions/employee/attendance'
import type { Room } from '@/data/admin/rooms'
import type { Seat } from '@/data/admin/seat-map'
import type { KioskRoom } from '@/app/kiosk/KioskClient'

const TIMEOUT_MS = 30_000

interface KioskSeatPickerProps {
  rooms: KioskRoom[]
  studentName: string
  studentId: string
  /** Existing attendance row — only for the reserved-seat "change" flow. */
  attendanceId: string
  /** true = walk-in not yet marked present (create attendance on choice/skip). */
  deferred: boolean
  /** Reserved seat being changed, if any. null = walk-in choosing a first seat. */
  currentSeatId: string | null
  onDone: () => void
  onTimeout: () => void
}

export function KioskSeatPicker({
  rooms,
  studentName,
  studentId,
  attendanceId,
  deferred,
  currentSeatId,
  onDone,
  onTimeout,
}: KioskSeatPickerProps) {
  const [activeRoomId, setActiveRoomId] = useState(rooms[0]?.id ?? '')
  const [pending, setPending] = useState<Seat | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Bumped on any interaction to restart the inactivity timeout.
  const [activity, setActivity] = useState(0)
  const bump = () => setActivity((n) => n + 1)

  // Inactivity timeout: if the student walks away without choosing, close the
  // picker. For a deferred walk-in this means they are never marked present.
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout
  useEffect(() => {
    const t = setTimeout(() => onTimeoutRef.current(), TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [activity])

  const onErr = ({ error }: { error: { serverError?: string } }) =>
    setError(error.serverError ?? 'Place non disponible.')

  const assign = useAction(assignSeatAction, { onSuccess: onDone, onError: onErr })
  const change = useAction(changeSeatAction, { onSuccess: onDone, onError: onErr })
  const skip = useAction(kioskCheckinSeatlessAction, { onSuccess: onDone, onError: onErr })

  const isPending =
    assign.status === 'executing' ||
    change.status === 'executing' ||
    skip.status === 'executing'

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? rooms[0]

  function handleSeatClick(seat: Seat) {
    if (seat.status !== 'free') return
    setError(null)
    setPending(seat)
    bump()
  }

  function handleConfirm() {
    if (!pending || isPending) return
    if (deferred) {
      // Walk-in commits to a seat → create attendance + occupy it now.
      assign.execute({ student_id: studentId, seat_id: pending.id, room_id: pending.room_id })
    } else {
      // Reserved student changing seats → move existing attendance.
      change.execute({
        attendanceId,
        fromSeatId: currentSeatId!,
        seat_id: pending.id,
        room_id: pending.room_id,
      })
    }
  }

  function handleSkip() {
    if (isPending) return
    // Only meaningful for a deferred walk-in: mark present with no seat.
    skip.execute({ student_id: studentId })
  }

  if (!activeRoom) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
        <p className="text-2xl text-gray-300">Aucune salle disponible.</p>
        <button
          onClick={deferred ? handleSkip : onDone}
          className="rounded-xl bg-white px-8 py-4 text-lg font-semibold text-black"
        >
          Continuer
        </button>
      </div>
    )
  }

  const roomForMap: Room = {
    id: activeRoom.id,
    name: activeRoom.name,
    status: activeRoom.status,
    status_note: activeRoom.status_note,
  } as Room

  return (
    <div className="flex-1 flex flex-col min-h-0 p-6 gap-4">
      {/* Header */}
      <div className="text-center shrink-0">
        <p className="text-3xl font-bold text-white">{studentName}</p>
        <p className="text-lg text-gray-400 mt-1">
          {currentSeatId ? 'Changez de place' : 'Choisissez votre place'}
        </p>
      </div>

      {/* Big, obvious "not sure" escape — above the map, deferred walk-ins only */}
      {deferred && (
        <button
          onClick={handleSkip}
          disabled={isPending}
          className="shrink-0 mx-auto w-full max-w-3xl rounded-2xl border-2 border-[#D97706] bg-[#D97706]/15 px-6 py-5 text-center text-xl font-bold text-[#FCD34D] hover:bg-[#D97706]/25 disabled:opacity-50"
        >
          Je ne suis pas sûr — je choisirai plus tard sur mon téléphone
        </button>
      )}

      {/* Room tabs */}
      {rooms.length > 1 && (
        <div className="flex flex-wrap justify-center gap-3 shrink-0">
          {rooms.map((room) => {
            const active = room.id === activeRoomId
            return (
              <button
                key={room.id}
                onClick={() => {
                  setActiveRoomId(room.id)
                  setPending(null)
                  bump()
                }}
                className={`rounded-xl px-6 py-3 text-lg font-semibold transition ${
                  active ? 'bg-white text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {room.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Seat map */}
      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        <div className="w-full max-w-4xl rounded-2xl bg-white p-4">
          <LiveSeatMap
            key={activeRoom.id}
            room={roomForMap}
            initialTables={activeRoom.tables}
            initialSeats={activeRoom.seats}
            mode="student"
            onSeatClick={handleSeatClick}
            highlightSeatId={currentSeatId}
            hideRoomName
          />
        </div>
      </div>

      {error && <p className="text-center text-red-400 text-sm shrink-0">{error}</p>}

      {/* Confirm bar */}
      <div className="shrink-0 flex flex-col items-center gap-3">
        {pending ? (
          <div className="flex w-full max-w-2xl items-center justify-center gap-4">
            <button
              onClick={() => setPending(null)}
              disabled={isPending}
              className="flex-1 rounded-xl border border-gray-600 py-4 text-lg text-gray-300 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="flex-[2] rounded-xl bg-[#16A34A] py-4 text-lg font-bold text-white disabled:opacity-60"
            >
              {isPending ? 'Confirmation…' : `Confirmer — Place ${pending.label}`}
            </button>
          </div>
        ) : (
          <p className="text-gray-500 text-base">
            Touchez une place libre (en bleu) pour la sélectionner
          </p>
        )}
      </div>
    </div>
  )
}
