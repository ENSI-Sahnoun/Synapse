'use server'

import { createSupabaseClient } from '@/supabase-clients/server'
import { getCachedLoggedInUserId } from '@/rsc-data/supabase'
import { revalidatePath } from 'next/cache'

const MAX_NAME_EDIT_DISTANCE = 5

// Levenshtein edit distance — how many single-character edits turn `a` into `b`.
function editDistance(a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  const d = Array.from({ length: rows }, (_, i) => [i, ...Array(cols - 1).fill(0)])
  for (let j = 1; j < cols; j++) d[0][j] = j
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
    }
  }
  return d[rows - 1][cols - 1]
}

export async function updateMyProfileAction(formData: FormData) {
  const fullName = (formData.get('full_name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim()
  const avatarUrl = formData.get('avatar_url') as string | null

  if (!fullName) return { error: 'Le nom est requis' }

  const userId = await getCachedLoggedInUserId()
  const supabase = await createSupabaseClient()

  const { data: current } = await supabase
    .from('profiles')
    .select('full_name, original_full_name')
    .eq('id', userId)
    .single()

  if (current && fullName !== current.full_name) {
    const distance = editDistance(current.original_full_name ?? '', fullName)
    if (distance > MAX_NAME_EDIT_DISTANCE) {
      return { error: `Le nom ne peut pas différer de plus de ${MAX_NAME_EDIT_DISTANCE} caractères du nom original.` }
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      phone: phone || null,
      avatar_url: avatarUrl || null,
    })
    .eq('id', userId)

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: 'Profil mis à jour' }
}
