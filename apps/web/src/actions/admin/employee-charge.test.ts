import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/safe-action', () => ({
  adminActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

type ActionArgs = { parsedInput: { items: { product_id: string; quantity: number }[]; employee_id: string | null } }
type ActionFn = (args: ActionArgs) => Promise<{ expenseId: string; totalDt: number }>

describe('createEmployeeChargeAction', () => {
  it('sends p_employee_id to the RPC', async () => {
    const rpc = vi.fn(async () => ({
      data: { expense_id: 'exp-1', total_dt: 5 },
      error: null,
    }))
    vi.doMock('@/supabase-clients/server', () => ({
      createSupabaseClient: vi.fn(async () => ({ rpc })),
    }))

    const { createEmployeeChargeAction } = await import('./employee-charge')
    const result = await (createEmployeeChargeAction as unknown as ActionFn)({
      parsedInput: {
        items: [{ product_id: 'p1', quantity: 2 }],
        employee_id: 'emp-1',
      },
    })

    expect(rpc).toHaveBeenCalledWith('pos_employee_charge', {
      p_items: [{ product_id: 'p1', quantity: 2 }],
      p_employee_id: 'emp-1',
    })
    expect(result).toEqual({ expenseId: 'exp-1', totalDt: 5 })
  })
})
