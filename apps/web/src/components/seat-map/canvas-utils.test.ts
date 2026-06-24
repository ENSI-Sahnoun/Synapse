import { describe, it, expect } from 'vitest'
import {
  snapToGrid,
  snapRotation,
  rotatePoint,
  chairPositionsAroundTable,
  distributeHorizontally,
  distributeVertically,
} from './canvas-utils'

describe('snapToGrid', () => {
  it('snaps 53 to 40 with grid 40', () => expect(snapToGrid(53, 40)).toBe(40))
  it('snaps 61 to 80 with grid 40', () => expect(snapToGrid(61, 40)).toBe(80))
  it('returns value unchanged when already on grid', () => expect(snapToGrid(80, 40)).toBe(80))
})

describe('snapRotation', () => {
  it('snaps 7 to 0 with snap 15', () => expect(snapRotation(7, 15)).toBe(0))
  it('snaps 8 to 15 with snap 15', () => expect(snapRotation(8, 15)).toBe(15))
  it('wraps 360 to 0', () => expect(snapRotation(360, 15)).toBe(0))
  it('snaps 352 to 345 with snap 15', () => expect(snapRotation(352, 15)).toBe(345))
})

describe('rotatePoint', () => {
  it('90deg rotation around origin moves (1,0) to (0,1)', () => {
    const r = rotatePoint(1, 0, 0, 0, 90)
    expect(r.x).toBeCloseTo(0, 5)
    expect(r.y).toBeCloseTo(1, 5)
  })
  it('0deg rotation is identity', () => {
    const r = rotatePoint(3, 4, 0, 0, 0)
    expect(r.x).toBeCloseTo(3, 5)
    expect(r.y).toBeCloseTo(4, 5)
  })
})

describe('chairPositionsAroundTable', () => {
  it('returns correct count', () => {
    const table = { position_x: 200, position_y: 200, width: 120, height: 80, rotation: 0 }
    expect(chairPositionsAroundTable(table, 4)).toHaveLength(4)
  })
  it('returns empty for count 0', () => {
    const table = { position_x: 0, position_y: 0, width: 120, height: 80, rotation: 0 }
    expect(chairPositionsAroundTable(table, 0)).toHaveLength(0)
  })
})

describe('distributeHorizontally', () => {
  it('distributes 3 elements with 20px gap', () => {
    const elements = [
      { x: 0, width: 60 },
      { x: 200, width: 60 },
      { x: 100, width: 60 },
    ]
    const result = distributeHorizontally(elements, 20)
    // sorted order: 0, 100, 200 → positions: 0, 80, 160
    expect(result[0]).toBe(0)   // was at x=0
    expect(result[2]).toBe(80)  // was at x=100 (2nd in sorted)
    expect(result[1]).toBe(160) // was at x=200 (3rd in sorted)
  })
})

describe('distributeVertically', () => {
  it('distributes 2 elements with 20px gap', () => {
    const elements = [
      { y: 100, height: 40 },
      { y: 0, height: 40 },
    ]
    const result = distributeVertically(elements, 20)
    // sorted: y=0 first → positions: 0, 60
    expect(result[1]).toBe(0)  // was at y=0
    expect(result[0]).toBe(60) // was at y=100
  })
})
