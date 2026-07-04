import 'server-only'
import { headers } from 'next/headers'

/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * Intended as defense-in-depth for unauthenticated auth actions (QR login,
 * password login, password reset). It is per-instance: on Vercel Fluid Compute
 * a determined attacker spread across instances gets a higher effective limit,
 * but combined with the large QR token space and Supabase's own auth throttling
 * this is enough to stop naive brute force and accidental hammering.
 *
 * For a hard guarantee across instances, back this with Redis/Upstash later —
 * the call sites don't change.
 */
type Bucket = { hits: number[]; }

const buckets = new Map<string, Bucket>()
let lastSweep = Date.now()

// Periodically drop empty/stale buckets so the map can't grow unbounded.
function sweep(now: number, windowMs: number) {
  if (now - lastSweep < windowMs) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < windowMs)
    if (bucket.hits.length === 0) buckets.delete(key)
  }
}

export async function getClientIp(): Promise<string> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return h.get('x-real-ip') ?? 'unknown'
}

/**
 * Throws a user-facing error when `name`+IP exceeds `limit` requests within
 * `windowMs`. Call at the top of an action.
 */
export async function enforceRateLimit(
  name: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): Promise<void> {
  const ip = await getClientIp()
  const now = Date.now()
  sweep(now, windowMs)

  const key = `${name}:${ip}`
  const bucket = buckets.get(key) ?? { hits: [] }
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs)

  if (bucket.hits.length >= limit) {
    throw new Error('Trop de tentatives. Réessayez dans quelques minutes.')
  }

  bucket.hits.push(now)
  buckets.set(key, bucket)
}
