'use server'

import { z } from 'zod'
import { studentActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { notifyAllStaff } from '@/data/notifications/inapp'

export const airdropQrCode = studentActionClient
  .schema(z.object({}))
  .action(async ({ ctx: { userId } }) => {
    const supabase = await createSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, qr_token')
      .eq('id', userId)
      .maybeSingle()

    if (!profile?.qr_token) throw new Error('Code QR indisponible.')

    await notifyAllStaff('qr_airdrop', profile.full_name ?? 'Un étudiant', {
      link: profile.qr_token,
    })

    return { success: true }
  })
