/**
 * Backfill script: regenerate all student profiles.qr_token values using HMAC.
 *
 * Usage:
 *   QR_HMAC_SECRET=<secret> SUPABASE_SERVICE_ROLE_KEY=<key> \
 *     NEXT_PUBLIC_SUPABASE_URL=<url> \
 *     npx tsx apps/web/src/scripts/backfill-qr-tokens.ts
 *
 * Safe to run multiple times — idempotent (same input always produces same token).
 */
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const secret = process.env.QR_HMAC_SECRET

if (!url || !serviceKey || !secret) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, QR_HMAC_SECRET')
  process.exit(1)
}

function generateToken(studentId: string): string {
  const hmac = createHmac('sha256', secret!).update(studentId).digest('hex')
  return `SYNAPSE-${studentId}-${hmac}`
}

const supabase = createClient(url, serviceKey)

async function main() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'student')

  if (error) {
    console.error('Failed to fetch profiles:', error.message)
    process.exit(1)
  }

  console.log(`Found ${profiles.length} student profiles to backfill.`)

  let updated = 0
  let failed = 0

  for (const profile of profiles) {
    const newToken = generateToken(profile.id)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ qr_token: newToken })
      .eq('id', profile.id)

    if (updateError) {
      console.error(`Failed to update profile ${profile.id}:`, updateError.message)
      failed++
    } else {
      updated++
    }
  }

  console.log(`Done. Updated: ${updated}, Failed: ${failed}`)
  if (failed > 0) process.exit(1)
}

main()
