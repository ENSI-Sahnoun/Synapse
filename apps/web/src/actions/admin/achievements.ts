'use server'

import { adminActionClient } from '@/lib/safe-action'
import {
  createAchievementSchema,
  updateAchievementSchema,
  toggleAchievementSchema,
  createLevelSchema,
  updateLevelSchema,
  deleteLevelSchema,
} from '@/utils/zod-schemas/achievement'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export const createAchievementAction = adminActionClient
  .schema(createAchievementSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { data, error } = await supabase
      .from('achievements')
      .insert({
        ...parsedInput,
        is_active: true,
        threshold: parsedInput.threshold ?? null,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    revalidatePath('/admin/achievements')
    return { achievement: data }
  })

export const updateAchievementAction = adminActionClient
  .schema(updateAchievementSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...updates } = parsedInput
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('achievements')
      .update({
        ...updates,
        threshold: updates.threshold ?? null,
      })
      .eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/achievements')
    return { success: true }
  })

export const toggleAchievementAction = adminActionClient
  .schema(toggleAchievementSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('achievements')
      .update({ is_active: parsedInput.is_active })
      .eq('id', parsedInput.id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/achievements')
    return { success: true }
  })

export const upsertLevelAction = adminActionClient
  .schema(updateLevelSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase.from('levels').upsert(
      {
        level: parsedInput.level,
        xp_required: parsedInput.xp_required,
        label: parsedInput.label ?? null,
      },
      { onConflict: 'level' },
    )
    if (error) throw new Error(error.message)
    revalidatePath('/admin/achievements')
    return { success: true }
  })

export const deleteLevelAction = adminActionClient
  .schema(deleteLevelSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('levels')
      .delete()
      .eq('level', parsedInput.level)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/achievements')
    return { success: true }
  })

export const grantAchievementAction = adminActionClient
  .schema(
    z.object({
      studentId: z.string().uuid(),
      achievementId: z.string().uuid(),
    }),
  )
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase.rpc('admin_grant_achievement', {
      p_student_id: parsedInput.studentId,
      p_achievement_id: parsedInput.achievementId,
    })
    if (error) throw new Error(error.message)
    revalidatePath('/admin/achievements')
    return { success: true }
  })
