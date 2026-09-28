/**
 * Qué destino de la navegación corresponde a la pantalla actual.
 *
 * Aparte del componente para poder probarlo sin React ni el router.
 */
export type DestinationKey = 'panel' | 'sessions' | 'add' | 'offers' | 'profile';

const under = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

/**
 * `/sesiones/nueva` es Registrar, no Partidos, aunque empiece igual: se
 * chequea primero la ruta más específica.
 */
export function activeDestination(pathname: string): DestinationKey | null {
  if (under(pathname, '/sesiones/nueva')) return 'add';
  if (under(pathname, '/sesiones')) return 'sessions';
  if (under(pathname, '/panel')) return 'panel';
  if (under(pathname, '/perfil')) return 'profile';
  if (under(pathname, '/turnos')) return 'offers';
  return null;
}
