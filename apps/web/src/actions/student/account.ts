'use server'

import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'

export async function updateEmailAction(formData: FormData) {
  const newEmail = formData.get('email') as string
  if (!newEmail?.trim()) return { error: 'Email requis' }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
  if (error) return { error: error.message }

  return { success: 'Un lien de confirmation a été envoyé à votre nouvel email.' }
}

export async function updatePasswordAction(formData: FormData) {
  const currentPassword = formData.get('current_password') as string
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (!currentPassword) return { error: 'Mot de passe actuel requis' }
  if (!password || password.length < 8) return { error: 'Nouveau mot de passe trop court (8 caractères min)' }
  if (password !== confirm) return { error: 'Les mots de passe ne correspondent pas' }
  if (password === currentPassword) return { error: 'Le nouveau mot de passe doit être différent' }

  const supabase = await createSupabaseClient()

  // Verify current password by re-authenticating
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Session invalide' }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  if (signInError) return { error: 'Mot de passe actuel incorrect' }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  return { success: 'Mot de passe mis à jour.' }
}

export async function updateNotificationPrefsAction(prefs: { push_enabled: boolean; email_digest: boolean }) {
  const supabase = await createSupabaseClient()
  const { error } = await supabase.auth.updateUser({
    data: {
      push_enabled: prefs.push_enabled,
      email_digest: prefs.email_digest,
    },
  })
  if (error) return { error: error.message }
  revalidatePath('/student/settings')
  return { success: true }
}
