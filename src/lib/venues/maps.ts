/**
 * Enlaces a Google Maps.
 *
 * Usa las "Maps URLs" públicas: un enlace común, sin API key, sin costo y sin
 * cuenta de facturación. No es la API de Places — no consulta nada desde
 * nuestro servidor ni guarda datos de Google, así que no choca con la decisión
 * del §13. Google recibe la búsqueda recién cuando el usuario hace clic.
 *
 * https://developers.google.com/maps/documentation/urls/get-started
 */

const SEARCH = 'https://www.google.com/maps/search/';

/** Busca un lugar por texto: "Top Padel Córdoba". */
export function mapsSearchUrl(query: string): string | null {
  const q = query.trim();
  if (!q) return null;
  return `${SEARCH}?${new URLSearchParams({ api: '1', query: q }).toString()}`;
}

/**
 * Abre un punto exacto. Cuando la sede tenga coordenadas (bloque 7), el
 * enlace deja de depender de que el nombre sea único.
 */
export function mapsPointUrl(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return `${SEARCH}?${new URLSearchParams({ api: '1', query: `${lat},${lng}` }).toString()}`;
}
