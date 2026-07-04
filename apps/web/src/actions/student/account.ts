'use server'

import { createSupabaseClient } from '@/supabase-clients/server'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { revalidatePath } from 'next/cache'

export async function setupCredentialsAction(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Email invalide' }
  if (email.endsWith('@synapse.local')) return { error: 'Email invalide' }
  if (!password || password.length < 8) return { error: 'Mot de passe trop court (8 caractères min)' }
  if (password !== confirm) return { error: 'Les mots de passe ne correspondent pas' }

  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Session invalide' }

  const admin = createSupabaseAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('role, credentials_set')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'student') return { error: 'Accès refusé' }
  if (profile.credentials_set) return { error: 'Votre compte est déjà sécurisé.' }

  // Placeholder addresses can't receive a confirmation mail — set the email
  // directly via the admin API and mark it confirmed.
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    email,
    password,
    email_confirm: true,
  })
  if (updateError) {
    if (updateError.message.toLowerCase().includes('already')) {
      return { error: 'Cet email est déjà utilisé par un autre compte.' }
    }
    return { error: updateError.message }
  }

  const { error: flagError } = await admin
    .from('profiles')
    .update({ credentials_set: true })
    .eq('id', user.id)
  if (flagError) return { error: flagError.message }

  revalidatePath('/student', 'layout')
  return { success: 'Compte sécurisé ! Utilisez désormais votre email et mot de passe pour vous connecter.' }
}

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

  // Safety net: an account that manages its own password no longer qualifies
  // for QR login.
  await createSupabaseAdminClient()
    .from('profiles')
    .update({ credentials_set: true })
    .eq('id', user.id)

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
