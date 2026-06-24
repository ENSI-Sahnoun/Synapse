'use client'

import { Stage, Layer, Rect, Text, Group, Arc } from 'react-konva'
import type { RoomTable, Seat } from '@/data/admin/seat-map'

const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 600

const SEAT_W = 30
const SEAT_H = 26
const BACK_Y = -(SEAT_H / 2) - 2 - 10

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
  tables: RoomTable[]
  seats: Seat[]
  currentSeatId?: string
}

export function RoomMap({ tables, seats, currentSeatId }: Props) {
  return (
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
            const isMine = seat.id === currentSeatId
            const fill = isMine ? '#22c55e' : (SEAT_FILL[seat.status] ?? '#3b82f6')
            const opacity = seat.status === 'out_of_service' ? 0.55 : 1
            return (
              <Group key={seat.id} x={seat.position_x} y={seat.position_y} rotation={seat.rotation} opacity={opacity}>
                <Arc x={0} y={BACK_Y + 5} innerRadius={11} outerRadius={19} angle={160} rotation={-80} fill={fill} stroke="#1e3a5f" strokeWidth={1.5} listening={false} />
                <Rect x={-SEAT_W / 2} y={-SEAT_H / 2} width={SEAT_W} height={SEAT_H} fill={fill} stroke="#1e3a5f" strokeWidth={1.5} cornerRadius={4} />
                <Text x={-SEAT_W / 2} y={-SEAT_H / 2} text={seat.label} fontSize={seat.label.length > 2 ? 9 : 11} fontStyle="bold" fill="#ffffff" align="center" verticalAlign="middle" width={SEAT_W} height={SEAT_H} listening={false} />
              </Group>
            )
          })}
        </Layer>
      </Stage>
    </div>
  )
}
