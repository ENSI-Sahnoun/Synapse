import { describe, it, expect, vi, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.QR_HMAC_SECRET = 'test-secret-for-checkin-tests'
})

vi.mock('@/lib/safe-action', () => ({
  employeeActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}))

vi.mock('@/supabase-clients/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}))

describe('checkinAction schema', () => {
  it('is exported', async () => {
    const mod = await import('./checkin-action')
    expect(mod.checkinAction).toBeDefined()
  })
})

describe('isValidQrTokenFormat', () => {
  it('rejects tokens without SYNAPSE- prefix', async () => {
    const { isValidQrTokenFormat } = await import('@/lib/qr-token')
    expect(isValidQrTokenFormat('NOT-A-REAL-TOKEN')).toBe(false)
  })

  it('accepts valid format', async () => {
    const { isValidQrTokenFormat } = await import('@/lib/qr-token')
    expect(isValidQrTokenFormat('SYNAPSE-AB3X9K2M')).toBe(true)
  })
})
