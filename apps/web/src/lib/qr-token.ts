import 'server-only'
import { createHmac } from 'crypto'

const PREFIX = 'SYNAPSE-'
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/**
 * Generates a QR token deterministically from a student's ID and their current token_version.
 * Format: SYNAPSE-{8 uppercase alphanumeric chars}
 *
 * Same studentId + same version → same token (deterministic).
 * Bumping token_version in the DB invalidates the old token and produces a new unique one.
 * Verified by DB lookup (qr_token column) — no need to re-derive on the server.
 */
export function generateQrToken(studentId: string, version: number): string {
  const secret = process.env.QR_HMAC_SECRET
  if (!secret) throw new Error('QR_HMAC_SECRET is not set')
  const bytes = createHmac('sha256', secret)
    .update(`${studentId}:${version}`)
    .digest()
  const suffix = Array.from(bytes.slice(0, 8))
    .map((b) => CHARS[b % CHARS.length])
    .join('')
  return `${PREFIX}${suffix}`
}

/**
 * Returns true if the token has the SYNAPSE- prefix and a non-empty suffix.
 * Actual student lookup is done by DB query in the check-in action.
 */
export function isValidQrTokenFormat(token: string): boolean {
  return token.startsWith(PREFIX) && token.length > PREFIX.length
}
