import { describe, it, expect, vi } from 'vitest'

describe('listChargeablePeople', () => {
  it('queries profiles with role in (employee, admin), sorted by full_name', async () => {
    const order = vi.fn(async () => ({
      data: [
        { id: 'p2', full_name: 'Zoé' },
        { id: 'p1', full_name: 'Amine' },
      ],
      error: null,
    }))
    const inFn = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ in: inFn }))
    const from = vi.fn(() => ({ select }))

    vi.doMock('@/supabase-clients/server', () => ({
      createSupabaseClient: vi.fn(async () => ({ from })),
    }))

    const { listChargeablePeople } = await import('./chargeable-people')
    const result = await listChargeablePeople()

    expect(from).toHaveBeenCalledWith('profiles')
    expect(select).toHaveBeenCalledWith('id, full_name')
    expect(inFn).toHaveBeenCalledWith('role', ['employee', 'admin'])
    expect(order).toHaveBeenCalledWith('full_name', { ascending: true })
    expect(result).toEqual([
      { id: 'p2', fullName: 'Zoé' },
      { id: 'p1', fullName: 'Amine' },
    ])
  })
})
