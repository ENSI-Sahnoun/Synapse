import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/safe-action', () => ({
  adminActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn().mockReturnValue({}),
  },
}))

describe('product actions', () => {
  it('updateProductAction is defined', async () => {
    const { updateProductAction } = await import('./products')
    expect(updateProductAction).toBeDefined()
  })
})
