'use server'

import { z } from 'zod'
import { studentActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'

const schema = z.object({ optOut: z.boolean() })

export const setLeaderboardOptOut = studentActionClient
  .schema(schema)
  .action(async ({ parsedInput: { optOut }, ctx: { userId } }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('profiles')
      .update({ leaderboard_opt_out: optOut })
      .eq('id', userId)
    if (error) throw new Error('Impossible de mettre à jour la préférence de classement.')
    revalidatePath('/student/settings')
    revalidatePath('/student/dashboard')
    return { success: true, optOut }
  })
