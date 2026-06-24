'use client'

import { Stage, Layer, Rect, Circle, Text, Group } from 'react-konva'
import type { RoomTable, Seat } from '@/data/admin/seat-map'

const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 600
const SEAT_RADIUS = 24

const TABLE_FILL: Record<string, string> = {
  free: '#f8fafc',
  occupied: '#fef3c7',
  reserved: '#fef3c7',
}
const TABLE_STROKE: Record<string, string> = {
  free: '#94a3b8',
  occupied: '#f59e0b',
  reserved: '#f59e0b',
}
const SEAT_FILL: Record<string, string> = {
  free: '#3b82f6',
  occupied: '#ef4444',
  reserved: '#ef4444',
  out_of_service: '#9ca3af',
}

type Props = {
  tables: RoomTable[]
  seats: Seat[]
  currentSeatId?: string
}

export function RoomMap({ tables, seats, currentSeatId }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border bg-slate-50" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
      <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
        <Layer>
          {tables.map((table) => (
            <Group
              key={table.id}
              x={table.position_x}
              y={table.position_y}
              rotation={table.rotation}
              offsetX={table.width / 2}
              offsetY={table.height / 2}
            >
              <Rect
                width={table.width}
                height={table.height}
                fill={TABLE_FILL[table.status] ?? '#f8fafc'}
                stroke={TABLE_STROKE[table.status] ?? '#94a3b8'}
                strokeWidth={1.5}
                cornerRadius={6}
              />
              {table.label ? (
                <Text
                  text={table.label}
                  fontSize={11}
                  fill="#475569"
                  align="center"
                  verticalAlign="middle"
                  width={table.width}
                  height={table.height}
                />
              ) : null}
            </Group>
          ))}

          {seats.map((seat) => {
            const isMine = seat.id === currentSeatId
            const fill = isMine ? '#22c55e' : (SEAT_FILL[seat.status] ?? '#3b82f6')
            return (
              <Group
                key={seat.id}
                x={seat.position_x}
                y={seat.position_y}
                rotation={seat.rotation}
              >
                <Circle
                  radius={SEAT_RADIUS}
                  fill={fill}
                  stroke="#1e3a5f"
                  strokeWidth={1.5}
                  opacity={seat.status === 'out_of_service' ? 0.5 : 1}
                />
                <Text
                  text={seat.label}
                  fontSize={seat.label.length > 2 ? 10 : 13}
                  fontStyle="bold"
                  fill="#ffffff"
                  align="center"
                  verticalAlign="middle"
                  width={SEAT_RADIUS * 2}
                  height={SEAT_RADIUS * 2}
                  offsetX={SEAT_RADIUS}
                  offsetY={SEAT_RADIUS}
                />
              </Group>
            )
          })}
        </Layer>
      </Stage>
    </div>
  )
}
