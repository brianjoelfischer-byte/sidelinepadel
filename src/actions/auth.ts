'use server';

import { z } from 'zod';

import { clientEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { defaultLocale, locales } from '@/i18n/routing';

/**
 * Acciones de autenticación.
 *
 * Sin contraseñas: magic link por email y Google OAuth. Sin contraseñas no hay
 * hash débil, ni relleno de credenciales, ni recuperación insegura — es la
 * superficie de ataque que se elimina gratis (§8.1).
 */

const localeSchema = z.enum(locales).catch(defaultLocale);

const sendMagicLinkSchema = z.object({
  email: z.email().max(254),
  locale: localeSchema,
});

export type AuthResult =
  | { ok: true }
  | { ok: false; error: 'invalid_email' | 'rate_limited' | 'unavailable' };

/**
 * Manda el enlace de acceso.
 *
 * Devuelve `ok: true` exista o no la cuenta. Distinguir los dos casos sería
 * enumeración: cualquiera podría averiguar qué direcciones están registradas
 * probando emails.
 */
export async function sendMagicLink(input: unknown): Promise<AuthResult> {
  const parsed = sendMagicLinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_email' };

  const { email, locale } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${clientEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?locale=${locale}`,
      // El alta ocurre al entrar por primera vez; el perfil se crea después,
      // en el onboarding, donde se verifica la edad.
      shouldCreateUser: true,
    },
  });

  if (error) {
    // Supabase ya limita el envío por email y por IP. Se distingue solo ese
    // caso porque el usuario necesita saber que tiene que esperar.
    if (error.status === 429) return { ok: false, error: 'rate_limited' };
    return { ok: false, error: 'unavailable' };
  }

  return { ok: true };
}

const oauthSchema = z.object({ locale: localeSchema });

/** Devuelve la URL de Google a la que hay que mandar al usuario. */
export async function startGoogleSignIn(
  input: unknown,
): Promise<{ ok: true; url: string } | { ok: false; error: 'unavailable' }> {
  const { locale } = oauthSchema.parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${clientEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?locale=${locale}`,
      // `skipBrowserRedirect` porque redirigimos desde el servidor: así el
      // flujo no depende de que el cliente tenga JS habilitado.
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) return { ok: false, error: 'unavailable' };
  return { ok: true, url: data.url };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
