import { describe, it, expect, vi } from 'vitest'

vi.mock('@/supabase-clients/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}))

vi.mock('@/supabase-clients/server', () => ({
  createSupabaseClient: vi.fn(),
}))

vi.mock('@/utils/helpers', () => ({
  toSiteURL: (path: string) => `http://localhost:3000${path}`,
}))

describe('signInWithQrAction', () => {
  it('should be defined', async () => {
    const { signInWithQrAction } = await import('./auth')
    expect(signInWithQrAction).toBeDefined()
  })
})

describe('qr token format guard', () => {
  it('accepts SYNAPSE- prefixed tokens and rejects others', async () => {
    const { isValidQrTokenFormat } = await import('@/lib/qr-token')
    expect(isValidQrTokenFormat('SYNAPSE-ABCD1234')).toBe(true)
    expect(isValidQrTokenFormat('SYNAPSE-')).toBe(false)
    expect(isValidQrTokenFormat('random-string')).toBe(false)
    expect(isValidQrTokenFormat('')).toBe(false)
  })
})
