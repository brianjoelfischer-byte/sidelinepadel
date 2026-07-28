import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

/**
 * Envoltorios de navegación que mantienen el locale de la URL.
 * Usar SIEMPRE estos en lugar de los de `next/link` y `next/navigation`:
 * un `<Link>` de Next pierde el prefijo de idioma y saca al usuario de su locale.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
