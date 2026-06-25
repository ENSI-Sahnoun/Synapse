'use client'

import { useEffect, useState } from 'react'
import { Stage, Layer, Rect, Text, Group } from 'react-konva'
import { createClient } from '@/supabase-clients/client'
import { CapacityBadge } from './CapacityBadge'
import type { RoomTable, Seat } from '@/data/admin/seat-map'
import type { Room } from '@/data/admin/rooms'

const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 600

const SEAT_W = 30
const SEAT_H = 26
const BACK_H = 9
const BACK_GAP = 3
const BACK_Y = -(SEAT_H / 2) - BACK_GAP - BACK_H

const TABLE_FILL: Record<string, string> = {
  free: '#fde8c8',
  occupied: '#fef3c7',
  reserved: '#fef3c7',
}
const TABLE_STROKE: Record<string, string> = {
  free: '#a16207',
  occupied: '#f59e0b',
  reserved: '#f59e0b',
}
const SEAT_FILL: Record<string, string> = {
  free: '#3b82f6',
  occupied: '#ef4444',
  reserved: '#f59e0b',
  out_of_service: '#9ca3af',
}

type Props = {
  room: Room
  initialTables: RoomTable[]
  initialSeats: Seat[]
  mode: 'employee' | 'student' | 'readonly'
  onSeatClick?: (seat: Seat) => void
}

export function LiveSeatMap({ room, initialTables, initialSeats, mode, onSeatClick }: Props) {
  const [tables, setTables] = useState<RoomTable[]>(initialTables)
  const [seats, setSeats] = useState<Seat[]>(initialSeats)

  const occupiedCount = seats.filter((s) => s.status === 'occupied').length
  const isRoomClosed = room.status === 'closed' || room.status === 'reserved'

  useEffect(() => {
    const supabase = createClient()

    const tablesChannel = supabase
      .channel(`live-tables:room_id=eq.${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables', filter: `room_id=eq.${room.id}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as RoomTable
            setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
          } else if (payload.eventType === 'INSERT') {
            const inserted = payload.new as RoomTable
            setTables((prev) => {
              if (prev.find((t) => t.id === inserted.id)) return prev
              return [...prev, inserted]
            })
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string }
            setTables((prev) => prev.filter((t) => t.id !== deleted.id))
          }
        },
      )
      .subscribe()

    const seatsChannel = supabase
      .channel(`live-seats:room_id=eq.${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'seats', filter: `room_id=eq.${room.id}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Seat
            setSeats((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
          } else if (payload.eventType === 'INSERT') {
            const inserted = payload.new as Seat
            setSeats((prev) => {
              if (prev.find((s) => s.id === inserted.id)) return prev
              return [...prev, inserted]
            })
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string }
            setSeats((prev) => prev.filter((s) => s.id !== deleted.id))
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(tablesChannel)
      void supabase.removeChannel(seatsChannel)
    }
  }, [room.id])

  function isSeatClickable(seat: Seat): boolean {
    if (mode === 'readonly') return false
    if (mode === 'student') {
      if (isRoomClosed) return false
      return seat.status === 'free'
    }
    // employee: any seat except out_of_service
    return seat.status !== 'out_of_service'
  }

  function handleSeatClick(seat: Seat) {
    if (!isSeatClickable(seat)) return
    onSeatClick?.(seat)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="font-semibold">{room.name}</h2>
        <CapacityBadge occupiedCount={occupiedCount} totalSeats={seats.length} />
      </div>

      {isRoomClosed && (
        <div className="rounded-md border border-orange-200 bg-orange-50 px-4 py-2 text-sm text-orange-800">
          <span className="font-medium">
            {room.status === 'closed' ? 'Salle fermée' : 'Salle réservée'}
          </span>
          {room.status_note ? (
            <span className="ml-2">— {room.status_note}</span>
          ) : null}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-slate-50" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
        <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
          <Layer>
            {tables.map((table) => {
              const w = table.width
              const h = table.height
              const lx = -w / 2
              const ly = -h / 2
              const LEG = 8
              const fill = TABLE_FILL[table.status] ?? '#fde8c8'
              const stroke = TABLE_STROKE[table.status] ?? '#a16207'
              return (
                <Group key={table.id} x={table.position_x} y={table.position_y} rotation={table.rotation}>
                  <Rect x={lx} y={ly} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={1.5} cornerRadius={4} shadowBlur={2} shadowColor="#00000022" shadowOffsetY={1} />
                  <Rect x={lx + 6} y={ly + 6} width={w - 12} height={h - 12} fill="transparent" stroke="#c2855a" strokeWidth={0.8} cornerRadius={2} listening={false} />
                  <Rect x={lx} y={ly} width={LEG} height={LEG} fill="#6b7280" cornerRadius={2} listening={false} />
                  <Rect x={lx + w - LEG} y={ly} width={LEG} height={LEG} fill="#6b7280" cornerRadius={2} listening={false} />
                  <Rect x={lx} y={ly + h - LEG} width={LEG} height={LEG} fill="#6b7280" cornerRadius={2} listening={false} />
                  <Rect x={lx + w - LEG} y={ly + h - LEG} width={LEG} height={LEG} fill="#6b7280" cornerRadius={2} listening={false} />
                  {table.label ? (
                    <Text x={lx} y={ly} text={table.label} fontSize={12} fontStyle="bold" fill="#78350f" align="center" verticalAlign="middle" width={w} height={h} listening={false} />
                  ) : null}
                </Group>
              )
            })}

            {seats.map((seat) => {
              const clickable = isSeatClickable(seat)
              const fill = SEAT_FILL[seat.status] ?? '#3b82f6'
              const opacity = seat.status === 'out_of_service' ? 0.55 : 1
              return (
                <Group
                  key={seat.id}
                  x={seat.position_x}
                  y={seat.position_y}
                  rotation={seat.rotation}
                  opacity={opacity}
                  onClick={() => handleSeatClick(seat)}
                  onTap={() => handleSeatClick(seat)}
                  style={{ cursor: clickable ? 'pointer' : 'default' }}
                >
                  <Rect x={-SEAT_W / 2} y={BACK_Y} width={SEAT_W} height={BACK_H} fill={fill} stroke="#1e3a5f" strokeWidth={1.5} cornerRadius={[4, 4, 1, 1]} listening={false} />
                  <Rect x={-SEAT_W / 2} y={-SEAT_H / 2} width={SEAT_W} height={SEAT_H} fill={fill} stroke="#1e3a5f" strokeWidth={1.5} cornerRadius={[1, 1, 4, 4]} />
                  <Text x={-SEAT_W / 2} y={-SEAT_H / 2} text={seat.label} fontSize={seat.label.length > 2 ? 9 : 11} fontStyle="bold" fill="#ffffff" align="center" verticalAlign="middle" width={SEAT_W} height={SEAT_H} listening={false} />
                </Group>
              )
            })}
          </Layer>
        </Stage>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-blue-500" /> Libre
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" /> Occupée
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-yellow-500" /> Réservée
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-gray-400" /> Hors service
        </span>
      </div>
    </div>
  )
}
