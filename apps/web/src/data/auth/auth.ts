'use server';
import { actionClient } from '@/lib/safe-action';
import { createSupabaseClient } from '@/supabase-clients/server';
import { createSupabaseAdminClient } from '@/supabase-clients/admin';
import { toSiteURL } from '@/utils/helpers';
import { z } from 'zod';

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/**
 * Signs in a user with email and password.
 * @param {Object} params - The parameters for sign in.
 * @param {string} params.email - The user's email address.
 * @param {string} params.password - The user's password.
 * @throws {Error} If there's an error during sign in.
 */
export const signInWithPasswordAction = actionClient
  .schema(signInSchema)
  .action(async ({ parsedInput: { email, password } }) => {
    const supabase = await createSupabaseClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Email ou mot de passe incorrect.')
      }
      if (error.message.includes('Email not confirmed')) {
        throw new Error('Veuillez confirmer votre email avant de vous connecter.')
      }
      throw new Error('Erreur lors de la connexion.')
    }

    const ROLE_HOME: Record<string, string> = {
      admin: '/admin/dashboard',
      employee: '/employee/dashboard',
      student: '/student/dashboard',
    }

    // Use admin client — same-request session cookies aren't readable via the
    // regular client after signInWithPassword (getAll() returns pre-request cookies)
    const admin = createSupabaseAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    const redirectTo = ROLE_HOME[profile?.role ?? ''] ?? '/login'
    return { redirectTo }
  });

const signInWithQrSchema = z.object({
  qr_token: z.string().min(1),
});

/**
 * Signs in a student by their QR card token.
 * Only allowed for student accounts that have not yet set their own
 * credentials (credentials_set = false). Mints a session server-side via
 * generateLink + verifyOtp — no email is sent.
 */
export const signInWithQrAction = actionClient
  .schema(signInWithQrSchema)
  .action(async ({ parsedInput: { qr_token } }) => {
    const { isValidQrTokenFormat } = await import('@/lib/qr-token');
    const token = qr_token.trim().toUpperCase();

    if (!isValidQrTokenFormat(token)) {
      throw new Error('Code QR invalide ou expiré.');
    }

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, credentials_set, is_archived')
      .eq('qr_token', token)
      .maybeSingle();

    if (!profile || profile.role !== 'student' || profile.is_archived) {
      throw new Error('Code QR invalide ou expiré.');
    }

    if (profile.credentials_set) {
      throw new Error(
        'Ce compte est protégé par mot de passe. Connectez-vous avec votre email.'
      );
    }

    const { data: authUser, error: userError } =
      await admin.auth.admin.getUserById(profile.id);
    if (userError || !authUser.user.email) {
      throw new Error('Code QR invalide ou expiré.');
    }

    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: authUser.user.email,
      });
    if (linkError || !linkData.properties?.hashed_token) {
      throw new Error('Erreur lors de la connexion. Réessayez.');
    }

    const supabase = await createSupabaseClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: 'magiclink',
      token_hash: linkData.properties.hashed_token,
    });
    if (verifyError) {
      throw new Error('Erreur lors de la connexion. Réessayez.');
    }

    return { redirectTo: '/student/dashboard' };
  });

const signInWithMagicLinkSchema = z.object({
  email: z.string().email(),
  next: z.string().optional(),
});

/**
 * Sends a magic link to the user's email for passwordless sign in.
 * @param {Object} params - The parameters for magic link sign in.
 * @param {string} params.email - The user's email address.
 * @param {string} [params.next] - The URL to redirect to after successful sign in.
 * @throws {Error} If there's an error sending the magic link.
 */
export const signInWithMagicLinkAction = actionClient
  .schema(signInWithMagicLinkSchema)
  .action(async ({ parsedInput: { email, next } }) => {
    const supabase = await createSupabaseClient();
    const redirectUrl = new URL(toSiteURL('/auth/callback'));
    if (next) {
      redirectUrl.searchParams.set('next', next);
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl.toString(),
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    // No need to return anything if the operation is successful
  });

const signInWithProviderSchema = z.object({
  provider: z.enum(['google', 'github', 'twitter']),
  next: z.string().optional(),
});

/**
 * Initiates OAuth sign in with a specified provider.
 * @param {Object} params - The parameters for OAuth sign in.
 * @param {('google'|'github'|'gitlab'|'bitbucket')} params.provider - The OAuth provider.
 * @param {string} [params.next] - The URL to redirect to after successful sign in.
 * @returns {Promise<{url: string}>} The URL to redirect the user to for OAuth sign in.
 * @throws {Error} If there's an error initiating OAuth sign in.
 */
export const signInWithProviderAction = actionClient
  .schema(signInWithProviderSchema)
  .action(async ({ parsedInput: { provider, next } }) => {
    const supabase = await createSupabaseClient();
    const redirectToURL = new URL(toSiteURL('/auth/callback'));
    if (next) {
      redirectToURL.searchParams.set('next', next);
    }
    const { error, data } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectToURL.toString(),
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return { url: data.url };
  });

const resetPasswordSchema = z.object({
  email: z.string().email(),
});

/**
 * Initiates the password reset process for a user.
 * @param {Object} params - The parameters for password reset.
 * @param {string} params.email - The email address of the user requesting password reset.
 * @throws {Error} If there's an error initiating the password reset.
 */
export const resetPasswordAction = actionClient
  .schema(resetPasswordSchema)
  .action(async ({ parsedInput: { email } }) => {
    const supabase = await createSupabaseClient();
    const redirectToURL = new URL(toSiteURL('/auth/callback'));
    redirectToURL.searchParams.set('next', '/update-password');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectToURL.toString(),
    });

    if (error) {
      throw new Error(error.message);
    }

    // No need to return anything if the operation is successful
  });
