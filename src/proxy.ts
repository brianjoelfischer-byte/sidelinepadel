import { createServerClient } from '@supabase/ssr';
import createIntlMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';

import { supabaseConfig } from '@/lib/env';
import { routing } from '@/i18n/routing';

/**
 * En Next 16 este archivo se llama `proxy` (antes `middleware`).
 *
 * Hace DOS cosas, y el orden importa:
 *
 *  1. next-intl resuelve el idioma y arma la respuesta (que puede ser una
 *     redirección a la URL con prefijo).
 *  2. Supabase refresca la sesión y escribe las cookies actualizadas EN ESA
 *     respuesta.
 *
 * Si se hicieran al revés, la redirección de next-intl descartaría las cookies
 * de sesión y el usuario quedaría deslogueado en cada navegación.
 */
const handleI18n = createIntlMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const response = handleI18n(request);

  // Sin configuracion de Supabase no hay sesion que refrescar. El sitio sigue
  // navegable en desarrollo en vez de tirar 500 en cada pagina; en produccion
  // `supabaseConfig()` lanza, asi que este camino no existe alla.
  const config = supabaseConfig();
  if (!config) return response;

  const supabase = createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refresca el token si venció. Se usa `getUser()` y no `getSession()` a
  // propósito: getUser valida el JWT contra el servidor de auth, mientras que
  // getSession solo lee la cookie — que el cliente podría haber manipulado.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  /**
   * Todo menos rutas internas de Next y las que NO llevan prefijo de idioma:
   *
   *   auth/  — el callback de Supabase. La URL la arma el proveedor de auth,
   *            no nuestra navegación. Si el proxy le antepusiera el idioma,
   *            `/auth/callback` se convertiría en `/es/auth/callback` y el
   *            route handler no existiría ahí: el login no funcionaría nunca.
   *   i/     — invitaciones: se entra por token, no navegando.
   *   api/   — endpoints internos y cron.
   */
  matcher: ['/((?!api|auth|_next|_vercel|i/|.*\\..*).*)'],
};
