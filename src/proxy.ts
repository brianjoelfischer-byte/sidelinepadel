import { createServerClient } from '@supabase/ssr';
import createIntlMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';

import { clientEnv } from '@/lib/env';
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

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
   * Todo menos rutas internas de Next, la API y archivos con extensión.
   * `/i/...` (invitaciones) y `/api/...` quedan fuera a propósito: no llevan
   * prefijo de idioma porque se entra por token, no por navegación.
   */
  matcher: ['/((?!api|_next|_vercel|i/|.*\\..*).*)'],
};
