'use server'

import { studentActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'

export type CelebrationEvent = {
  id: string
  kind: 'purchase' | 'subscription' | 'locker'
  payload: {
    items?: { name: string; quantity: number }[]
    total_dt?: number
    plan_name?: string
    locker_number?: number
  }
  points: number
  created_at: string
}

export const getUnseenCelebrationAction = studentActionClient.action(async ({ ctx }) => {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('celebration_events')
    .select('id, kind, payload, points, created_at')
    .eq('student_id', ctx.userId)
    .is('celebrated_at', null)
    .gt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data as unknown as CelebrationEvent
})

export const markCelebrationsSeenAction = studentActionClient.action(async () => {
  const supabase = await createSupabaseClient()
  await supabase.rpc('mark_my_celebrations_seen')
})
