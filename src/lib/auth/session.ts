import 'server-only';

import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/i18n/routing';

/**
 * Acceso a la sesión desde el servidor.
 *
 * Todo usa `getUser()` y nunca `getSession()`: getUser valida el JWT contra el
 * servidor de auth, mientras que getSession solo lee una cookie que el cliente
 * podría haber editado. Para decidir permisos, la diferencia es todo.
 */

export interface SessionUser {
  id: string;
  email: string;
}

/** El usuario en curso, o `null` si no hay sesión. No redirige. */
export async function getUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;
  return { id: user.id, email: user.email };
}

/**
 * `redirect` de next-intl ya devuelve `never`, pero TypeScript solo aplica ese
 * estrechamiento cuando la función se referencia por un nombre con anotación
 * explícita — y la nuestra viene de desestructurar `createNavigation()`. Esta
 * constante le da esa anotación, así el código que sigue queda inalcanzable
 * para el compilador igual que lo es en ejecución.
 */
const redirectToLogin: (locale: Locale) => never = (locale) =>
  redirect({ href: '/entrar', locale });

/**
 * El usuario en curso, o redirige a login. Falla cerrado por diseño.
 *
 * Se usa en el layout de `(app)`, no página por página: una página nueva
 * nace protegida en vez de nacer abierta hasta que alguien se acuerde.
 */
export async function requireUser(locale: Locale): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirectToLogin(locale);
  return user;
}

/**
 * Columnas del perfil que usa la app.
 *
 * Va como UN literal y no concatenado: Supabase infiere el tipo del resultado
 * a partir del texto del select, y una concatenación lo degrada a `string`,
 * con lo que el resultado queda sin tipar.
 *
 * `birth_date` no está y no debe estar: solo sirvió para verificar la edad y
 * no se expone nunca (§8.5).
 */
const PROFILE_COLUMNS =
  'id, display_name, slug, avatar_path, country_code, locale, timezone, declared_level, perceived_level, effective_level, rater_count, preferred_side, preferred_hand, racket, is_public, role' as const;

/** El perfil del usuario, o `null` si todavía no completó el onboarding. */
export async function getProfile(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  return data;
}
