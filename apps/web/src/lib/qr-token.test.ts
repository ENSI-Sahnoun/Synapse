// apps/web/src/lib/qr-token.test.ts
import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.QR_HMAC_SECRET = 'test-secret-key-for-unit-tests-only'
})

// Dynamic import required because the module is 'server-only'
describe('generateQrToken', () => {
  it('returns a token with correct prefix', async () => {
    const { generateQrToken } = await import('./qr-token')
    const studentId = '550e8400-e29b-41d4-a716-446655440000'
    const token = generateQrToken(studentId)
    expect(token).toMatch(/^SYNAPSE-550e8400-e29b-41d4-a716-446655440000-[a-f0-9]{64}$/)
  })

  it('is deterministic for same input', async () => {
    const { generateQrToken } = await import('./qr-token')
    const studentId = '550e8400-e29b-41d4-a716-446655440000'
    expect(generateQrToken(studentId)).toBe(generateQrToken(studentId))
  })

  it('produces different tokens for different student IDs', async () => {
    const { generateQrToken } = await import('./qr-token')
    const t1 = generateQrToken('550e8400-e29b-41d4-a716-446655440000')
    const t2 = generateQrToken('660e8400-e29b-41d4-a716-446655440001')
    expect(t1).not.toBe(t2)
  })
})

describe('verifyQrToken', () => {
  it('returns studentId for valid token', async () => {
    const { generateQrToken, verifyQrToken } = await import('./qr-token')
    const studentId = '550e8400-e29b-41d4-a716-446655440000'
    const token = generateQrToken(studentId)
    expect(verifyQrToken(token)).toBe(studentId)
  })

  it('returns null for tampered token', async () => {
    const { verifyQrToken } = await import('./qr-token')
    const tampered = 'SYNAPSE-550e8400-e29b-41d4-a716-446655440000-' + 'a'.repeat(64)
    expect(verifyQrToken(tampered)).toBeNull()
  })

  it('returns null for invalid prefix', async () => {
    const { verifyQrToken } = await import('./qr-token')
    expect(verifyQrToken('INVALID-TOKEN')).toBeNull()
  })

  it('returns null for empty string', async () => {
    const { verifyQrToken } = await import('./qr-token')
    expect(verifyQrToken('')).toBeNull()
  })
})
