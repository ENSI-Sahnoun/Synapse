import crypto from 'node:crypto'

const TOKEN_TTL_MS = 15 * 60 * 1000 // 15 minutes

function secret() {
  const s = process.env.QR_HMAC_SECRET
  if (!s) throw new Error('QR_HMAC_SECRET is not set')
  return s
}

function sign(payload: string) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('hex')
}

export type ExportScope = 'financials' | 'attendance'

export function issueExportToken(scope: ExportScope, from: string, to: string, adminId: string) {
  const issuedAt = Date.now()
  const payload = `${scope}|${from}|${to}|${adminId}|${issuedAt}`
  return `${issuedAt}.${sign(payload)}`
}

export function verifyExportToken(
  token: string,
  scope: ExportScope,
  from: string,
  to: string,
  adminId: string,
): boolean {
  const [issuedAtStr, signature] = token.split('.')
  if (!issuedAtStr || !signature) return false

  const issuedAt = Number(issuedAtStr)
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > TOKEN_TTL_MS) return false

  const expected = sign(`${scope}|${from}|${to}|${adminId}|${issuedAt}`)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
