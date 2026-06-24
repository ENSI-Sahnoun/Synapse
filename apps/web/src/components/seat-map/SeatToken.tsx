'use client'

import { Group, Rect, Text, Arc } from 'react-konva'
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

// Chair dimensions (top-down view). Origin = visual center of the seat pad.
const SEAT_W = 30
const SEAT_H = 26
const BACK_W = 30
const BACK_H = 10
const BACK_GAP = 2   // gap between seat and backrest
// backrest sits above the seat (negative y = "towards the table")
const BACK_Y = -(SEAT_H / 2) - BACK_GAP - BACK_H

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
  const isOutOfService = seat.status === 'out_of_service'
  const fill = STATUS_FILL[seat.status] ?? '#3b82f6'
  const stroke = isSelected ? '#f59e0b' : '#1e3a5f'
  const strokeWidth = isSelected ? 2.5 : 1.5
  const opacity = isOutOfService ? 0.55 : 1

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
      {/* Backrest — curved arc on top */}
      <Arc
        x={0}
        y={BACK_Y + BACK_H / 2}
        innerRadius={BACK_W / 2 - 4}
        outerRadius={BACK_W / 2 + 4}
        angle={160}
        rotation={-80}  // center the arc upward
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        shadowBlur={isSelected ? 6 : 0}
        shadowColor="#f59e0b"
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
        strokeWidth={strokeWidth}
        cornerRadius={4}
        shadowBlur={isSelected ? 8 : 2}
        shadowColor={isSelected ? '#f59e0b' : '#00000044'}
        shadowOffsetY={isSelected ? 0 : 1}
      />
      {/* Label on seat */}
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
