import { supabaseConfig } from '@/lib/env';

/**
 * ¿Está activado "Continuar con Google" en Supabase?
 *
 * Activar Google es un paso del dashboard (Authentication → Sign In /
 * Providers), no del código. Mientras no esté hecho, Supabase responde
 * "provider is not enabled" en una pantalla en blanco con JSON — y eso es lo
 * que veía quien tocaba el botón. Así que la app pregunta antes de ofrecerlo.
 *
 * `/auth/v1/settings` es público (pide solo la clave anon) y dice qué
 * proveedores están activos. Se guarda 5 minutos: activarlo en el dashboard
 * hace aparecer el botón solo, sin publicar de nuevo.
 *
 * Ante cualquier falla devuelve `false`: esconder el botón un rato es mejor
 * que mandar a alguien a una pantalla de error. El email siempre funciona.
 */
export async function isGoogleEnabled(
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const config = supabaseConfig();
  if (!config) return false;

  try {
    const res = await fetcher(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.anonKey },
      signal: AbortSignal.timeout(3000),
      next: { revalidate: 300 },
    });
    if (!res.ok) return false;
    const body: unknown = await res.json();
    return readGoogleFlag(body);
  } catch {
    return false;
  }
}

/** Separado para probarlo sin red. */
export function readGoogleFlag(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false;
  const external = (body as { external?: unknown }).external;
  if (typeof external !== 'object' || external === null) return false;
  return (external as { google?: unknown }).google === true;
}
