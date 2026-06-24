'use server'

import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { generateQrToken } from '@/lib/qr-token'

/**
 * Assigns (or regenerates) the QR token for a student.
 * On first call: uses token_version=0.
 * On regeneration: increments token_version first → new unique token derived from studentId+version.
 * Retries up to 3 times to handle the race with the handle_new_user trigger.
 */
export async function assignQrToken(studentId: string): Promise<void> {
  const adminClient = createSupabaseAdminClient()

  const MAX_ATTEMPTS = 3
  const RETRY_DELAY_MS = 200

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Read current version
    const { data: profile, error: fetchError } = await adminClient
      .from('profiles')
      .select('token_version')
      .eq('id', studentId)
      .single()

    if (fetchError || !profile) {
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
        continue
      }
      throw new Error(`Impossible d'assigner le token QR: profil introuvable après ${MAX_ATTEMPTS} tentatives`)
    }

    const nextVersion = (profile.token_version ?? 0) + 1
    const token = generateQrToken(studentId, nextVersion)

    const { data, error } = await adminClient
      .from('profiles')
      .update({ qr_token: token, token_version: nextVersion })
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
