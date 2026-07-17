'use client'

import { useRef, useState } from 'react'
import { Stage, Layer, Rect, Text, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FloppyDisk } from '@phosphor-icons/react'
import { updateRoomShapesAction } from '@/actions/admin/rooms'
import type { Room } from '@/data/admin/rooms'
import {
  FLOOR_PLAN_CANVAS_WIDTH,
  FLOOR_PLAN_CANVAS_HEIGHT,
  DEFAULT_ROOM_WIDTH,
  DEFAULT_ROOM_HEIGHT,
  splitRoomsByShape,
} from '@/lib/floor-plan'

type RoomShapeState = {
  id: string
  name: string
  status: string
  shape_x: number
  shape_y: number
  shape_width: number
  shape_height: number
}

function toShapeState(room: Room, index: number): RoomShapeState {
  return {
    id: room.id,
    name: room.name,
    status: room.status,
    shape_x:
      room.shape_x ??
      Math.min(
        40 + (index % 4) * (DEFAULT_ROOM_WIDTH + 20),
        FLOOR_PLAN_CANVAS_WIDTH - DEFAULT_ROOM_WIDTH,
      ),
    shape_y:
      room.shape_y ??
      Math.min(
        40 + Math.floor(index / 4) * (DEFAULT_ROOM_HEIGHT + 20),
        FLOOR_PLAN_CANVAS_HEIGHT - DEFAULT_ROOM_HEIGHT,
      ),
    shape_width: room.shape_width ?? DEFAULT_ROOM_WIDTH,
    shape_height: room.shape_height ?? DEFAULT_ROOM_HEIGHT,
  }
}

export function FloorPlanEditor({ initialRooms }: { initialRooms: Room[] }) {
  const { placed, unplaced } = splitRoomsByShape(initialRooms)
  const [placedShapes, setPlacedShapes] = useState<RoomShapeState[]>(
    placed.map((room, i) => toShapeState(room, i)),
  )
  const [unplacedRooms, setUnplacedRooms] = useState<Room[]>(unplaced)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const rectRefs = useRef<Map<string, Konva.Rect>>(new Map())
  const transformerRef = useRef<Konva.Transformer>(null)

  const { execute: save, isPending: isSaving } = useAction(updateRoomShapesAction, {
    onSuccess: () => toast.success('Plan enregistré'),
    onError: ({ error }) => toast.error(error.serverError ?? "Erreur lors de l'enregistrement"),
  })

  function selectShape(id: string) {
    setSelectedId(id)
    const node = rectRefs.current.get(id)
    if (node && transformerRef.current) {
      transformerRef.current.nodes([node])
      transformerRef.current.getLayer()?.batchDraw()
    }
  }

  function placeRoom(room: Room) {
    setUnplacedRooms((prev) => prev.filter((r) => r.id !== room.id))
    setPlacedShapes((prev) => [...prev, toShapeState(room, prev.length)])
  }

  function handleDragEnd(id: string, x: number, y: number) {
    setPlacedShapes((prev) => prev.map((s) => (s.id === id ? { ...s, shape_x: x, shape_y: y } : s)))
  }

  function handleTransformEnd(id: string) {
    const node = rectRefs.current.get(id)
    if (!node) return
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    setPlacedShapes((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              shape_x: node.x(),
              shape_y: node.y(),
              shape_width: Math.max(20, s.shape_width * scaleX),
              shape_height: Math.max(20, s.shape_height * scaleY),
            }
          : s,
      ),
    )
  }

  function handleSave() {
    save({
      rooms: placedShapes.map((s) => ({
        id: s.id,
        shape_x: s.shape_x,
        shape_y: s.shape_y,
        shape_width: s.shape_width,
        shape_height: s.shape_height,
      })),
    })
  }

  return (
    <div className="flex gap-4">
      <div className="flex-1 space-y-3 min-w-0">
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving || placedShapes.length === 0} size="sm">
            <FloppyDisk className="mr-1 h-4 w-4" />
            {isSaving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
        <div
          className="relative overflow-hidden rounded-lg border bg-slate-50"
          style={{ width: FLOOR_PLAN_CANVAS_WIDTH, height: FLOOR_PLAN_CANVAS_HEIGHT }}
        >
          <Stage
            width={FLOOR_PLAN_CANVAS_WIDTH}
            height={FLOOR_PLAN_CANVAS_HEIGHT}
            onClick={(e) => {
              if (e.target === e.target.getStage()) {
                setSelectedId(null)
                transformerRef.current?.nodes([])
              }
            }}
          >
            <Layer>
              {placedShapes.map((shape) => (
                <Rect
                  key={shape.id}
                  ref={(node) => {
                    if (node) rectRefs.current.set(shape.id, node)
                    else rectRefs.current.delete(shape.id)
                  }}
                  x={shape.shape_x}
                  y={shape.shape_y}
                  width={shape.shape_width}
                  height={shape.shape_height}
                  fill="white"
                  stroke={selectedId === shape.id ? '#2563eb' : '#94a3b8'}
                  strokeWidth={selectedId === shape.id ? 3 : 1.5}
                  draggable
                  onClick={() => selectShape(shape.id)}
                  onTap={() => selectShape(shape.id)}
                  onDragEnd={(e) => handleDragEnd(shape.id, e.target.x(), e.target.y())}
                  onTransformEnd={() => handleTransformEnd(shape.id)}
                />
              ))}
              {placedShapes.map((shape) => (
                <Text
                  key={`label-${shape.id}`}
                  x={shape.shape_x}
                  y={shape.shape_y + shape.shape_height / 2 - 8}
                  width={shape.shape_width}
                  align="center"
                  text={shape.name}
                  fontSize={14}
                  listening={false}
                />
              ))}
              <Transformer ref={transformerRef} rotateEnabled={false} />
            </Layer>
          </Stage>
        </div>
        <p className="text-xs text-muted-foreground">
          Glissez pour déplacer · Sélectionnez pour redimensionner · Enregistrez pour sauvegarder
        </p>
      </div>

      <div className="w-56 space-y-2">
        <h2 className="text-sm font-semibold">Salles non placées</h2>
        {unplacedRooms.length === 0 && (
          <p className="text-xs text-muted-foreground">Toutes les salles sont placées.</p>
        )}
        {unplacedRooms.map((room) => (
          <Button
            key={room.id}
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => placeRoom(room)}
          >
            {room.name}
          </Button>
        ))}
      </div>
    </div>
  )
}
