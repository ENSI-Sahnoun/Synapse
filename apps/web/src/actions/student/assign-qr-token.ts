'use server'

import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { generateQrToken } from '@/lib/qr-token'

/**
 * Assigns an HMAC QR token to a student profile.
 * Uses the admin client to bypass RLS — must only be called from trusted server contexts.
 * Safe to call multiple times (idempotent — same student always gets same token).
 * Retries up to 3 times to handle the race with the handle_new_user trigger.
 */
export async function assignQrToken(studentId: string): Promise<void> {
  const token = generateQrToken(studentId)
  const adminClient = createSupabaseAdminClient()

  const MAX_ATTEMPTS = 3
  const RETRY_DELAY_MS = 200

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { data, error } = await adminClient
      .from('profiles')
      .update({ qr_token: token })
      .eq('id', studentId)
      .select('id')

    if (error) {
      throw new Error(`Impossible d'assigner le token QR: ${error.message}`)
    }

    if (data && data.length > 0) return

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    }
  }

  throw new Error(`Impossible d'assigner le token QR: profil introuvable après ${MAX_ATTEMPTS} tentatives`)
}
