// apps/web/src/lib/qr-token.ts
import 'server-only'
import { createHmac } from 'crypto'

/**
 * Generates a QR token for a student.
 * Format: SYNAPSE-{studentId}-{hex(hmac_sha256(studentId, QR_HMAC_SECRET))}
 *
 * The token is stored in profiles.qr_token and validated on every check-in.
 * The HMAC prevents token forgery — scanning an arbitrary UUID won't work.
 */
export function generateQrToken(studentId: string): string {
  const secret = process.env.QR_HMAC_SECRET
  if (!secret) {
    throw new Error('QR_HMAC_SECRET is not set')
  }
  const hmac = createHmac('sha256', secret).update(studentId).digest('hex')
  return `SYNAPSE-${studentId}-${hmac}`
}

/**
 * Verifies a scanned QR token string.
 * Returns the studentId if valid, or null if the HMAC doesn't match.
 */
export function verifyQrToken(token: string): string | null {
  const secret = process.env.QR_HMAC_SECRET
  if (!secret) {
    throw new Error('QR_HMAC_SECRET is not set')
  }
  // Format: SYNAPSE-{uuid}-{64-char hex}
  const prefix = 'SYNAPSE-'
  if (!token.startsWith(prefix)) return null

  // uuid is 36 chars, then '-', then 64-char hex
  const rest = token.slice(prefix.length) // "{uuid}-{hex}"
  const uuidLength = 36
  if (rest.length < uuidLength + 1 + 64) return null

  const studentId = rest.slice(0, uuidLength)
  const providedHmac = rest.slice(uuidLength + 1)

  const expectedHmac = createHmac('sha256', secret).update(studentId).digest('hex')

  // Constant-time comparison to prevent timing attacks
  if (providedHmac.length !== expectedHmac.length) return null
  let diff = 0
  for (let i = 0; i < expectedHmac.length; i++) {
    diff |= providedHmac.charCodeAt(i) ^ expectedHmac.charCodeAt(i)
  }
  return diff === 0 ? studentId : null
}
