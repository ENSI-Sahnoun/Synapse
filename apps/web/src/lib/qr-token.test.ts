import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.QR_HMAC_SECRET = 'test-secret-key-for-unit-tests-only'
})

const STUDENT_ID = '550e8400-e29b-41d4-a716-446655440000'

describe('generateQrToken', () => {
  it('returns token matching SYNAPSE-{8 uppercase alphanumeric}', async () => {
    const { generateQrToken } = await import('./qr-token')
    expect(generateQrToken(STUDENT_ID, 0)).toMatch(/^SYNAPSE-[A-Z0-9]{8}$/)
  })

  it('is deterministic for same studentId + version', async () => {
    const { generateQrToken } = await import('./qr-token')
    expect(generateQrToken(STUDENT_ID, 0)).toBe(generateQrToken(STUDENT_ID, 0))
  })

  it('produces different token when version bumped', async () => {
    const { generateQrToken } = await import('./qr-token')
    expect(generateQrToken(STUDENT_ID, 0)).not.toBe(generateQrToken(STUDENT_ID, 1))
  })

  it('produces different tokens for different student IDs', async () => {
    const { generateQrToken } = await import('./qr-token')
    const other = '660e8400-e29b-41d4-a716-446655440001'
    expect(generateQrToken(STUDENT_ID, 0)).not.toBe(generateQrToken(other, 0))
  })
})

describe('isValidQrTokenFormat', () => {
  it('accepts valid token', async () => {
    const { isValidQrTokenFormat } = await import('./qr-token')
    expect(isValidQrTokenFormat('SYNAPSE-AB3X9K2M')).toBe(true)
  })

  it('rejects missing prefix', async () => {
    const { isValidQrTokenFormat } = await import('./qr-token')
    expect(isValidQrTokenFormat('INVALID-TOKEN')).toBe(false)
  })

  it('rejects empty string', async () => {
    const { isValidQrTokenFormat } = await import('./qr-token')
    expect(isValidQrTokenFormat('')).toBe(false)
  })

  it('rejects bare prefix with no suffix', async () => {
    const { isValidQrTokenFormat } = await import('./qr-token')
    expect(isValidQrTokenFormat('SYNAPSE-')).toBe(false)
  })
})
