'use client'

import { useRef } from 'react'
import { Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'

export type TableData = {
  localId: string       // always a UUID (client-generated for new, DB id for persisted)
  id: string | undefined  // undefined for unsaved tables; DB uuid once persisted
  room_id: string
  label: string
  position_x: number
  position_y: number
  width: number
  height: number
  rotation: number      // 0–345, multiples of 15
}

type Props = {
  table: TableData
  isSelected: boolean
  onSelect: (localId: string) => void
  // x, y = new center position; dx, dy = actual drag delta from Konva (not state-derived)
  onDragEnd: (localId: string, x: number, y: number, dx: number, dy: number) => void
}

export function TableToken({ table, isSelected, onSelect, onDragEnd }: Props) {
  const dragStart = useRef({ x: 0, y: 0 })

  function handleDragStart(e: Konva.KonvaEventObject<DragEvent>) {
    dragStart.current = { x: e.target.x(), y: e.target.y() }
  }

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    const nx = e.target.x()
    const ny = e.target.y()
    onDragEnd(table.localId, nx, ny, nx - dragStart.current.x, ny - dragStart.current.y)
  }

  const w = table.width
  const h = table.height
  // table top-left corner in local space (group origin = center)
  const lx = -w / 2
  const ly = -h / 2
  const LEG = 8
  const legColor = isSelected ? '#b45309' : '#6b7280'

  return (
    <Group
      x={table.position_x}
      y={table.position_y}
      rotation={table.rotation}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onSelect(table.localId)}
      onTap={() => onSelect(table.localId)}
    >
      {/* Table surface — warm wood tone */}
      <Rect
        x={lx}
        y={ly}
        width={w}
        height={h}
        fill={isSelected ? '#fef3c7' : '#fde8c8'}
        stroke={isSelected ? '#f59e0b' : '#a16207'}
        strokeWidth={isSelected ? 2.5 : 1.5}
        cornerRadius={4}
        shadowBlur={isSelected ? 10 : 3}
        shadowColor={isSelected ? '#f59e0b' : '#00000033'}
        shadowOffsetY={isSelected ? 0 : 1}
      />
      {/* Inner frame / table inlay */}
      <Rect
        x={lx + 6}
        y={ly + 6}
        width={w - 12}
        height={h - 12}
        fill="transparent"
        stroke="#c2855a"
        strokeWidth={0.8}
        cornerRadius={2}
        listening={false}
      />
      {/* Legs — small squares at corners */}
      <Rect x={lx} y={ly} width={LEG} height={LEG} fill={legColor} cornerRadius={2} listening={false} />
      <Rect x={lx + w - LEG} y={ly} width={LEG} height={LEG} fill={legColor} cornerRadius={2} listening={false} />
      <Rect x={lx} y={ly + h - LEG} width={LEG} height={LEG} fill={legColor} cornerRadius={2} listening={false} />
      <Rect x={lx + w - LEG} y={ly + h - LEG} width={LEG} height={LEG} fill={legColor} cornerRadius={2} listening={false} />
      {/* Label */}
      {table.label ? (
        <Text
          x={lx}
          y={ly}
          text={table.label}
          fontSize={12}
          fontStyle="bold"
          fill="#78350f"
          align="center"
          verticalAlign="middle"
          width={w}
          height={h}
          listening={false}
        />
      ) : null}
    </Group>
  )
}
