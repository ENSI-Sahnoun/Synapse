'use client'

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
  onDragEnd: (localId: string, x: number, y: number) => void
}

export function TableToken({ table, isSelected, onSelect, onDragEnd }: Props) {
  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    onDragEnd(table.localId, e.target.x(), e.target.y())
  }

  return (
    <Group
      x={table.position_x}
      y={table.position_y}
      rotation={table.rotation}
      draggable
      onDragEnd={handleDragEnd}
      onClick={() => onSelect(table.localId)}
      onTap={() => onSelect(table.localId)}
      offsetX={table.width / 2}
      offsetY={table.height / 2}
    >
      <Rect
        x={0}
        y={0}
        width={table.width}
        height={table.height}
        fill="#f1f5f9"
        stroke={isSelected ? '#f59e0b' : '#94a3b8'}
        strokeWidth={isSelected ? 2.5 : 1.5}
        cornerRadius={6}
        shadowBlur={isSelected ? 8 : 0}
        shadowColor="#f59e0b"
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
  )
}
