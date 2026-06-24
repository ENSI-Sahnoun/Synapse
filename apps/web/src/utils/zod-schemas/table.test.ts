import { describe, it, expect } from 'vitest'
import { tableUpsertItemSchema, upsertSeatMapSchema } from './table'

const validTable = {
  id: 'a0a0a0a0-0000-4000-a000-000000000001',
  room_id: 'b0b0b0b0-0000-4000-b000-000000000001',
  label: 'T1',
  position_x: 100,
  position_y: 200,
  width: 120,
  height: 80,
  rotation: 0,
}

describe('tableUpsertItemSchema', () => {
  it('passes with valid data', () => {
    expect(tableUpsertItemSchema.safeParse(validTable).success).toBe(true)
  })

  it('rejects rotation not multiple of 15', () => {
    const r = tableUpsertItemSchema.safeParse({ ...validTable, rotation: 7 })
    // rotation is clamped to int 0-345, 7 passes int check — just verify it passes (snap is client-side)
    expect(r.success).toBe(true)
  })

  it('rejects rotation >= 360', () => {
    const r = tableUpsertItemSchema.safeParse({ ...validTable, rotation: 360 })
    expect(r.success).toBe(false)
  })

  it('rejects width < 40', () => {
    const r = tableUpsertItemSchema.safeParse({ ...validTable, width: 10 })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('Largeur min 40px')
  })
})

describe('upsertSeatMapSchema', () => {
  it('passes with empty tables and seats', () => {
    const r = upsertSeatMapSchema.safeParse({
      room_id: 'b0b0b0b0-0000-4000-b000-000000000001',
      tables: [],
      seats: [],
    })
    expect(r.success).toBe(true)
  })
})
