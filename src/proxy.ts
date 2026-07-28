import createMiddleware from 'next-intl/middleware';

import { routing } from '@/i18n/routing';

/**
 * En Next 16 este archivo se llama `proxy` (antes `middleware`). El handler
 * de next-intl es el mismo: resuelve el locale y redirige a la URL con prefijo.
 */
export default createMiddleware(routing);

export const config = {
  /**
   * Todo menos rutas internas de Next, la API y archivos con extensión.
   * `/i/...` (invitaciones) y `/api/...` quedan fuera a propósito: no llevan
   * prefijo de idioma porque se entra por token, no por navegación.
   */
  matcher: ['/((?!api|_next|_vercel|i/|.*\\..*).*)'],
};
