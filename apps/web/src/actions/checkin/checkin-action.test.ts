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

describe('verifyQrToken integration', () => {
  it('returns null for a malformed token', async () => {
    const { verifyQrToken } = await import('@/lib/qr-token')
    expect(verifyQrToken('NOT-A-REAL-TOKEN')).toBeNull()
  })
})
