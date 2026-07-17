import { describe, expect, it } from 'vitest'
import { hasPlacedShape, splitRoomsByShape, computeFitScale } from './floor-plan'

type TestRoom = {
  id: string
  shape_x: number | null
  shape_y: number | null
  shape_width: number | null
  shape_height: number | null
}

const placedRoom: TestRoom = { id: 'a', shape_x: 10, shape_y: 20, shape_width: 100, shape_height: 50 }
const unplacedRoom: TestRoom = { id: 'b', shape_x: null, shape_y: null, shape_width: null, shape_height: null }
const partialRoom: TestRoom = { id: 'c', shape_x: 5, shape_y: null, shape_width: 100, shape_height: 50 }

describe('hasPlacedShape', () => {
  it('returns true only when all four fields are non-null', () => {
    expect(hasPlacedShape(placedRoom)).toBe(true)
    expect(hasPlacedShape(unplacedRoom)).toBe(false)
    expect(hasPlacedShape(partialRoom)).toBe(false)
  })
})

describe('splitRoomsByShape', () => {
  it('splits rooms into placed and unplaced', () => {
    const { placed, unplaced } = splitRoomsByShape([placedRoom, unplacedRoom, partialRoom])
    expect(placed).toEqual([placedRoom])
    expect(unplaced).toEqual([unplacedRoom, partialRoom])
  })

  it('returns empty placed array when no rooms are placed', () => {
    const { placed, unplaced } = splitRoomsByShape([unplacedRoom])
    expect(placed).toEqual([])
    expect(unplaced).toEqual([unplacedRoom])
  })
})

describe('computeFitScale', () => {
  it('scales down when viewport is narrower than the canvas', () => {
    expect(computeFitScale(500, 1000)).toBe(0.5)
  })

  it('scales up when viewport is wider than the canvas', () => {
    expect(computeFitScale(2000, 1000)).toBe(2)
  })

  it('returns 1 for a zero or negative canvas width', () => {
    expect(computeFitScale(500, 0)).toBe(1)
    expect(computeFitScale(500, -10)).toBe(1)
  })
})
