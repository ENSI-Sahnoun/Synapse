/**
 * One-time backfill: regenerate QR tokens for all students still holding the old
 * long-format token (SYNAPSE-{uuid}-{64hex}) or no token at all.
 *
 * Run from apps/web:
 *   node --env-file=.env.local ../../node_modules/.bin/tsx scripts/backfill-qr-tokens.ts
 */

import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

const PREFIX = 'SYNAPSE-'
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const SHORT_TOKEN_RE = /^SYNAPSE-[A-Z0-9]{8}$/

function generateQrToken(studentId: string, version: number): string {
  const secret = process.env.QR_HMAC_SECRET
  if (!secret) throw new Error('QR_HMAC_SECRET not set')
  const bytes = createHmac('sha256', secret).update(`${studentId}:${version}`).digest()
  const suffix = Array.from(bytes.slice(0, 8)).map((b) => CHARS[b % CHARS.length]).join('')
  return `${PREFIX}${suffix}`
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, qr_token, token_version, student_number')
    .eq('role', 'student')

  if (error) throw new Error(`Fetch failed: ${error.message}`)
  if (!profiles?.length) { console.log('No students found.'); return }

  const stale = profiles.filter((p) => !p.qr_token || !SHORT_TOKEN_RE.test(p.qr_token))
  console.log(`${profiles.length} students total, ${stale.length} need backfill`)

  let ok = 0, fail = 0
  for (const p of stale) {
    const nextVersion = (p.token_version ?? 0) + 1
    const token = generateQrToken(p.id, nextVersion)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ qr_token: token, token_version: nextVersion })
      .eq('id', p.id)

    if (updateError) {
      console.error(`  ✗ #${p.student_number} (${p.id}): ${updateError.message}`)
      fail++
    } else {
      console.log(`  ✓ #${p.student_number} → ${token}`)
      ok++
    }
  }

  console.log(`\nDone: ${ok} updated, ${fail} failed`)
}

run().catch((e) => { console.error(e); process.exit(1) })
