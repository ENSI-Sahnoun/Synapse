'use server'

import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { generateQrToken } from '@/lib/qr-token'

/**
 * Assigns an HMAC QR token to a student profile.
 * Uses the admin client to bypass RLS — must only be called from trusted server contexts.
 * Safe to call multiple times (idempotent — same student always gets same token).
 */
export async function assignQrToken(studentId: string): Promise<void> {
  const token = generateQrToken(studentId)
  const adminClient = createSupabaseAdminClient()

  const { error } = await adminClient
    .from('profiles')
    .update({ qr_token: token })
    .eq('id', studentId)

  if (error) {
    throw new Error(`Impossible d'assigner le token QR: ${error.message}`)
  }
}
