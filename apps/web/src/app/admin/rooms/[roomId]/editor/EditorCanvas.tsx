'use client'

import { useCallback, useRef, useState } from 'react'
import { Stage, Layer, Rect } from 'react-konva'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SeatToken, type SeatTokenData } from '@/components/seat-map/SeatToken'
import { SeatEditPopover } from '@/components/seat-map/SeatEditPopover'
import { upsertSeatsAction, deleteSeatAction } from '@/actions/seats'
import type { Seat } from '@/data/seats'
import { Plus, FloppyDisk } from '@phosphor-icons/react'

const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 600
const SEAT_RADIUS = 24

function dbSeatToToken(s: Seat): SeatTokenData {
  return {
    localId: s.id,
    id: s.id,
    room_id: s.room_id,
    label: s.label,
    position_x: s.position_x,
    position_y: s.position_y,
    status: s.status as SeatTokenData['status'],
  }
}

function nextLabel(existing: SeatTokenData[]): string {
  const labels = new Set(existing.map((s) => s.label))
  const rows = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (const row of rows) {
    for (let n = 1; n <= 20; n++) {
      const label = `${row}${n}`
      if (!labels.has(label)) return label
    }
  }
  return `P${existing.length + 1}`
}

type Props = {
  roomId: string
  initialSeats: Seat[]
}

export function EditorCanvas({ roomId, initialSeats }: Props) {
  const [seats, setSeats] = useState<SeatTokenData[]>(initialSeats.map(dbSeatToToken))
  const [selectedLocalId, setSelectedLocalId] = useState<string | undefined>(undefined)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const popoverAnchorRef = useRef<HTMLDivElement>(null!)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedSeat = seats.find((s) => s.localId === selectedLocalId) ?? null

  const { execute: saveSeats, isPending: isSaving } = useAction(upsertSeatsAction, {
    onSuccess: ({ data }) => {
      if (data?.seats) {
        setSeats(data.seats.map(dbSeatToToken))
      }
      toast.success('Plan de salle enregistré')
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erreur lors de l'enregistrement")
    },
  })

  const { execute: deleteSeat } = useAction(deleteSeatAction, {
    onSuccess: () => {
      toast.success('Place supprimée')
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur lors de la suppression')
    },
  })

  const handleDragEnd = useCallback((localId: string, x: number, y: number) => {
    const clampedX = Math.max(SEAT_RADIUS, Math.min(CANVAS_WIDTH - SEAT_RADIUS, x))
    const clampedY = Math.max(SEAT_RADIUS, Math.min(CANVAS_HEIGHT - SEAT_RADIUS, y))
    setSeats((prev) =>
      prev.map((s) =>
        s.localId === localId ? { ...s, position_x: clampedX, position_y: clampedY } : s,
      ),
    )
  }, [])

  const handleSeatClick = useCallback((localId: string) => {
    setSelectedLocalId(localId)
    setPopoverOpen(true)
  }, [])

  const handleAddSeat = () => {
    const label = nextLabel(seats)
    const localId = crypto.randomUUID()
    const newSeat: SeatTokenData = {
      localId,
      id: undefined,
      room_id: roomId,
      label,
      position_x: 60 + (seats.length % 10) * 10,
      position_y: 60 + Math.floor(seats.length / 10) * 10,
      status: 'free',
    }
    setSeats((prev) => [...prev, newSeat])
    setSelectedLocalId(undefined)
  }

  const handleLabelChange = (localId: string, label: string) => {
    setSeats((prev) => prev.map((s) => (s.localId === localId ? { ...s, label } : s)))
  }

  const handleOutOfServiceToggle = (localId: string, outOfService: boolean) => {
    setSeats((prev) =>
      prev.map((s) =>
        s.localId === localId ? { ...s, status: outOfService ? 'out_of_service' : 'free' } : s,
      ),
    )
  }

  const handleDelete = (localId: string) => {
    const seat = seats.find((s) => s.localId === localId)
    if (seat?.id) {
      deleteSeat({ id: seat.id, room_id: roomId })
    }
    setSeats((prev) => prev.filter((s) => s.localId !== localId))
    setSelectedLocalId(undefined)
  }

  const handleSave = () => {
    if (seats.length === 0) {
      toast.error("Ajoutez au moins une place avant d'enregistrer")
      return
    }
    saveSeats({
      room_id: roomId,
      seats: seats.map((s) => ({
        id: s.id,
        room_id: roomId,
        label: s.label,
        position_x: s.position_x,
        position_y: s.position_y,
        status: s.status,
      })),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={handleAddSeat}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une place
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          <FloppyDisk className="mr-2 h-4 w-4" />
          {isSaving ? 'Enregistrement…' : 'Enregistrer le plan'}
        </Button>
        <span className="text-muted-foreground text-sm">
          {seats.length} place{seats.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-lg border bg-slate-50"
        style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
      >
        <div
          ref={popoverAnchorRef}
          className="pointer-events-none absolute"
          style={
            selectedSeat
              ? {
                  left: selectedSeat.position_x + SEAT_RADIUS,
                  top: selectedSeat.position_y - SEAT_RADIUS,
                }
              : { left: 0, top: 0 }
          }
        />

        <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
          <Layer>
            <Rect
              x={0}
              y={0}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              fill="transparent"
              onClick={() => {
                setSelectedLocalId(undefined)
                setPopoverOpen(false)
              }}
            />
            {seats.map((seat) => (
              <SeatToken
                key={seat.localId}
                seat={seat}
                isSelected={seat.localId === selectedLocalId}
                onDragEnd={handleDragEnd}
                onClick={handleSeatClick}
              />
            ))}
          </Layer>
        </Stage>

        <SeatEditPopover
          seat={selectedSeat}
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
          anchorRef={popoverAnchorRef}
          onLabelChange={handleLabelChange}
          onOutOfServiceToggle={handleOutOfServiceToggle}
          onDelete={handleDelete}
        />
      </div>

      <p className="text-muted-foreground text-xs">
        Cliquez sur une place pour la modifier. Faites glisser pour la repositionner.
        Appuyez sur Enregistrer pour sauvegarder le plan.
      </p>
    </div>
  )
}
