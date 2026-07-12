'use server'

import { z } from 'zod'
import { studentActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { notifyAllStaffNoPush } from '@/data/notifications/inapp'

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

    const { data: attendance } = await supabase
      .from('attendance')
      .select('seat_id')
      .eq('student_id', userId)
      .is('checked_out_at', null)
      .order('checked_in_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!attendance?.seat_id) throw new Error('Vous devez être présent dans une salle pour envoyer votre code.')

    const admin = createSupabaseAdminClient()
    const { data: seat } = await admin.from('seats').select('room_id').eq('id', attendance.seat_id).maybeSingle()

    if (!seat?.room_id) throw new Error('Vous devez être présent dans une salle pour envoyer votre code.')

    await notifyAllStaffNoPush('qr_airdrop', profile.full_name ?? 'Un étudiant', {
      link: profile.qr_token,
    })

    return { success: true }
  })
