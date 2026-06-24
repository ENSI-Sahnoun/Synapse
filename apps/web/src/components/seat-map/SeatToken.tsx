'use client'

import { Group, Circle, Text } from 'react-konva'
import type Konva from 'konva'

export type SeatTokenData = {
  localId: string           // stable client-side key, always set
  id: string | undefined    // DB id, undefined for unsaved seats
  room_id: string
  table_id: string | null   // null = independent chair
  label: string
  position_x: number
  position_y: number
  rotation: number          // 0–345, multiples of 15
  status: 'free' | 'occupied' | 'reserved' | 'out_of_service'
}

const RADIUS = 24

type Props = {
  seat: SeatTokenData
  isSelected: boolean
  onDragEnd: (localId: string, x: number, y: number) => void
  onClick: (localId: string) => void
}

export function SeatToken({ seat, isSelected, onDragEnd, onClick }: Props) {
  const isOutOfService = seat.status === 'out_of_service'
  const fill = isOutOfService ? '#9ca3af' : '#3b82f6'
  const strokeColor = isSelected ? '#f59e0b' : '#1e3a5f'

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    onDragEnd(seat.localId, e.target.x(), e.target.y())
  }

  return (
    <Group
      x={seat.position_x}
      y={seat.position_y}
      rotation={seat.rotation}
      draggable
      onDragEnd={handleDragEnd}
      onClick={() => onClick(seat.localId)}
      onTap={() => onClick(seat.localId)}
    >
      <Circle
        radius={RADIUS}
        fill={fill}
        stroke={strokeColor}
        strokeWidth={isSelected ? 3 : 1.5}
        shadowBlur={isSelected ? 8 : 0}
        shadowColor="#f59e0b"
        opacity={isOutOfService ? 0.5 : 1}
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
