'use server'

import { z } from 'zod'
import { adminActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'

const flagsSchema = z.object({
  enabled: z.boolean().optional(),
  prizeSecret: z.boolean().optional(),
  listSize: z.number().int().min(3).max(50).optional(),
})

export const setLeaderboardFlags = adminActionClient
  .schema(flagsSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const rows: { key: string; value: string }[] = []
    if (parsedInput.enabled !== undefined) rows.push({ key: 'leaderboard_enabled', value: String(parsedInput.enabled) })
    if (parsedInput.prizeSecret !== undefined) rows.push({ key: 'leaderboard_prize_secret', value: String(parsedInput.prizeSecret) })
    if (parsedInput.listSize !== undefined) rows.push({ key: 'leaderboard_list_size', value: String(parsedInput.listSize) })
    if (rows.length) {
      const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' })
      if (error) throw new Error('Impossible de mettre à jour les paramètres du classement.')
    }
    revalidatePath('/admin/loyalty')
    return { success: true }
  })

const categorySchema = z.object({
  category: z.enum(['visits', 'hours', 'spend']),
  enabled: z.boolean(),
  label: z.string().min(1).max(40),
  emoji: z.string().min(1).max(8),
  points_1: z.number().int().min(0).max(100000),
  points_2: z.number().int().min(0).max(100000),
  points_3: z.number().int().min(0).max(100000),
})

export const updateLeaderboardCategory = adminActionClient
  .schema(categorySchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { category, ...fields } = parsedInput
    const { error } = await supabase
      .from('leaderboard_config')
      .update(fields)
      .eq('category', category)
    if (error) throw new Error('Impossible de mettre à jour la catégorie.')
    revalidatePath('/admin/loyalty')
    return { success: true }
  })
