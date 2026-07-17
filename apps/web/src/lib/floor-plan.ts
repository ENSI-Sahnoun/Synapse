export const FLOOR_PLAN_CANVAS_WIDTH = 1000
export const FLOOR_PLAN_CANVAS_HEIGHT = 700
export const DEFAULT_ROOM_WIDTH = 200
export const DEFAULT_ROOM_HEIGHT = 150

export type RoomShapeFields = {
  shape_x: number | null
  shape_y: number | null
  shape_width: number | null
  shape_height: number | null
}

type PlacedShape = { shape_x: number; shape_y: number; shape_width: number; shape_height: number }

export function hasPlacedShape<T extends RoomShapeFields>(room: T): room is T & PlacedShape {
  return (
    room.shape_x !== null &&
    room.shape_y !== null &&
    room.shape_width !== null &&
    room.shape_height !== null
  )
}

export function splitRoomsByShape<T extends RoomShapeFields>(
  rooms: T[],
): { placed: (T & PlacedShape)[]; unplaced: T[] } {
  const placed: (T & PlacedShape)[] = []
  const unplaced: T[] = []
  for (const room of rooms) {
    if (hasPlacedShape(room)) {
      placed.push(room)
    } else {
      unplaced.push(room)
    }
  }
  return { placed, unplaced }
}

export function computeFitScale(viewportWidth: number, canvasWidth: number): number {
  if (canvasWidth <= 0) return 1
  return viewportWidth / canvasWidth
}
