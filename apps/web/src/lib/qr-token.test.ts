import { describe, it, expect } from 'vitest'

describe('generateQrToken', () => {
  it('returns token with SYNAPSE- prefix and 8-char suffix', async () => {
    const { generateQrToken } = await import('./qr-token')
    const token = generateQrToken()
    expect(token).toMatch(/^SYNAPSE-[A-Z0-9]{8}$/)
  })

  it('produces unique tokens on each call', async () => {
    const { generateQrToken } = await import('./qr-token')
    const tokens = new Set(Array.from({ length: 20 }, () => generateQrToken()))
    expect(tokens.size).toBe(20)
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
