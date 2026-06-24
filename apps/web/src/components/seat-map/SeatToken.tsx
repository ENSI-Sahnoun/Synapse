'use client'

import { Group, Circle, Text } from 'react-konva'
import type Konva from 'konva'

export type SeatTokenData = {
  id: string | undefined
  room_id: string
  label: string
  position_x: number
  position_y: number
  status: 'free' | 'occupied' | 'reserved' | 'out_of_service'
}

const STATUS_FILL: Record<SeatTokenData['status'], string> = {
  free: '#3b82f6',
  occupied: '#3b82f6',
  reserved: '#3b82f6',
  out_of_service: '#9ca3af',
}

const RADIUS = 24

type Props = {
  seat: SeatTokenData
  isSelected: boolean
  onDragEnd: (id: string | undefined, x: number, y: number) => void
  onClick: (id: string | undefined) => void
}

export function SeatToken({ seat, isSelected, onDragEnd, onClick }: Props) {
  const fill = seat.status === 'out_of_service' ? STATUS_FILL.out_of_service : STATUS_FILL.free
  const strokeColor = isSelected ? '#f59e0b' : '#1e3a5f'

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    onDragEnd(seat.id, e.target.x(), e.target.y())
  }

  return (
    <Group
      x={seat.position_x}
      y={seat.position_y}
      draggable
      onDragEnd={handleDragEnd}
      onClick={() => onClick(seat.id)}
      onTap={() => onClick(seat.id)}
    >
      <Circle
        radius={RADIUS}
        fill={fill}
        stroke={strokeColor}
        strokeWidth={isSelected ? 3 : 1.5}
        shadowBlur={isSelected ? 8 : 0}
        shadowColor="#f59e0b"
        opacity={seat.status === 'out_of_service' ? 0.5 : 1}
      />
      <Text
        text={seat.label}
        fontSize={seat.label.length > 2 ? 10 : 13}
        fontStyle="bold"
        fill="#ffffff"
        align="center"
        verticalAlign="middle"
        width={RADIUS * 2}
        height={RADIUS * 2}
        offsetX={RADIUS}
        offsetY={RADIUS}
      />
    </Group>
  )
}
