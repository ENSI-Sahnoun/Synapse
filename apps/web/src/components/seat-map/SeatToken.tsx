'use client'

import { Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'

export type SeatTokenData = {
  localId: string
  id: string | undefined
  room_id: string
  table_id: string | null
  label: string
  position_x: number
  position_y: number
  rotation: number
  status: 'free' | 'occupied' | 'reserved' | 'out_of_service'
}

// Top-down chair: backrest bar on top, seat pad below.
// Group origin = center of seat pad.
const SEAT_W = 30
const SEAT_H = 26
const BACK_H = 9    // thick backrest bar
const BACK_GAP = 3

const STATUS_FILL: Record<string, string> = {
  free: '#3b82f6',
  occupied: '#ef4444',
  reserved: '#f59e0b',
  out_of_service: '#9ca3af',
}

type Props = {
  seat: SeatTokenData
  isSelected: boolean
  onDragEnd: (localId: string, x: number, y: number) => void
  onClick: (localId: string) => void
}

export function SeatToken({ seat, isSelected, onDragEnd, onClick }: Props) {
  const fill = STATUS_FILL[seat.status] ?? '#3b82f6'
  const stroke = isSelected ? '#f59e0b' : '#1e3a5f'
  const strokeW = isSelected ? 2.5 : 1.5
  const opacity = seat.status === 'out_of_service' ? 0.55 : 1
  const backY = -(SEAT_H / 2) - BACK_GAP - BACK_H

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
      opacity={opacity}
    >
      {/* Backrest — thick rounded bar */}
      <Rect
        x={-SEAT_W / 2}
        y={backY}
        width={SEAT_W}
        height={BACK_H}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeW}
        cornerRadius={[4, 4, 1, 1]}
        listening={false}
      />
      {/* Seat pad */}
      <Rect
        x={-SEAT_W / 2}
        y={-SEAT_H / 2}
        width={SEAT_W}
        height={SEAT_H}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeW}
        cornerRadius={[1, 1, 4, 4]}
        shadowBlur={isSelected ? 8 : 2}
        shadowColor={isSelected ? '#f59e0b' : '#00000044'}
        shadowOffsetY={isSelected ? 0 : 1}
      />
      {/* Label */}
      <Text
        x={-SEAT_W / 2}
        y={-SEAT_H / 2}
        text={seat.label}
        fontSize={seat.label.length > 2 ? 9 : 11}
        fontStyle="bold"
        fill="#ffffff"
        align="center"
        verticalAlign="middle"
        width={SEAT_W}
        height={SEAT_H}
        listening={false}
      />
    </Group>
  )
}
