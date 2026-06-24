import 'server-only'
import { randomBytes } from 'crypto'

const PREFIX = 'SYNAPSE-'
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/**
 * Generates a QR token for a student.
 * Format: SYNAPSE-{8 random uppercase alphanumeric chars}
 * Stored in profiles.qr_token and verified by DB lookup on check-in.
 */
export function generateQrToken(): string {
  const bytes = randomBytes(8)
  const suffix = Array.from(bytes)
    .map((b) => CHARS[b % CHARS.length])
    .join('')
  return `${PREFIX}${suffix}`
}

/**
 * Returns true if the token has valid SYNAPSE- format (format check only).
 * Actual student lookup is done by DB query in the check-in action.
 */
export function isValidQrTokenFormat(token: string): boolean {
  return token.startsWith(PREFIX) && token.length >= PREFIX.length + 1
}
