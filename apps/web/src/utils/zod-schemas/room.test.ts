import { describe, expect, it } from 'vitest'
import { updateRoomShapesSchema } from './room'

describe('updateRoomShapesSchema', () => {
  it('accepts a valid list of room shapes', () => {
    const result = updateRoomShapesSchema.safeParse({
      rooms: [
        { id: '123e4567-e89b-12d3-a456-426614174000', shape_x: 10, shape_y: 20, shape_width: 100, shape_height: 50 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty rooms array', () => {
    const result = updateRoomShapesSchema.safeParse({ rooms: [] })
    expect(result.success).toBe(false)
  })

  it('rejects non-positive width or height', () => {
    const result = updateRoomShapesSchema.safeParse({
      rooms: [
        { id: '123e4567-e89b-12d3-a456-426614174000', shape_x: 10, shape_y: 20, shape_width: 0, shape_height: 50 },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-uuid id', () => {
    const result = updateRoomShapesSchema.safeParse({
      rooms: [{ id: 'not-a-uuid', shape_x: 10, shape_y: 20, shape_width: 100, shape_height: 50 }],
    })
    expect(result.success).toBe(false)
  })
})
