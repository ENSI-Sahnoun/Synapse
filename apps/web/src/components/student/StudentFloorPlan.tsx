'use client'

import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Rect, Text } from 'react-konva'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FLOOR_PLAN_CANVAS_WIDTH, FLOOR_PLAN_CANVAS_HEIGHT, computeFitScale } from '@/lib/floor-plan'
import type { RoomWithSeatCount } from '@/data/admin/rooms'

type PlacedRoom = RoomWithSeatCount & {
  shape_x: number
  shape_y: number
  shape_width: number
  shape_height: number
}

const STATUS_COLORS: Record<string, { fill: string; stroke: string }> = {
  open: { fill: '#dcfce7', stroke: '#16a34a' },
  closed: { fill: '#f1f5f9', stroke: '#94a3b8' },
  reserved: { fill: '#ffedd5', stroke: '#f97316' },
}

export function StudentFloorPlan({
  rooms,
  myRoomId,
}: {
  rooms: PlacedRoom[]
  myRoomId: string | null
}) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [pressedId, setPressedId] = useState<string | null>(null)

  useEffect(() => {
    function updateScale() {
      const width = containerRef.current?.offsetWidth ?? FLOOR_PLAN_CANVAS_WIDTH
      setScale(computeFitScale(width, FLOOR_PLAN_CANVAS_WIDTH))
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  function handleTap(room: PlacedRoom) {
    if (room.status !== 'open') {
      toast.info('Salle fermée')
      return
    }
    router.push(`/student/rooms/${room.id}/map`)
  }

  return (
    <div ref={containerRef} className="w-full overflow-hidden rounded-lg border bg-slate-50">
      <Stage width={FLOOR_PLAN_CANVAS_WIDTH * scale} height={FLOOR_PLAN_CANVAS_HEIGHT * scale} scaleX={scale} scaleY={scale}>
        <Layer>
          {rooms.map((room) => {
            const colors = STATUS_COLORS[room.status] ?? STATUS_COLORS.closed
            const isMyRoom = room.id === myRoomId
            return (
              <Rect
                key={room.id}
                x={room.shape_x}
                y={room.shape_y}
                width={room.shape_width}
                height={room.shape_height}
                fill={colors.fill}
                stroke={isMyRoom ? '#22c55e' : colors.stroke}
                strokeWidth={isMyRoom ? 3 : 2}
                opacity={pressedId === room.id ? 0.7 : 1}
                onTap={() => handleTap(room)}
                onClick={() => handleTap(room)}
                onTouchStart={() => setPressedId(room.id)}
                onTouchEnd={() => setPressedId(null)}
              />
            )
          })}
          {rooms.map((room) => (
            <Text
              key={`label-${room.id}`}
              x={room.shape_x}
              y={room.shape_y + room.shape_height / 2 - 8}
              width={room.shape_width}
              align="center"
              text={room.name}
              fontSize={14}
              fontStyle="600"
              listening={false}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  )
}
