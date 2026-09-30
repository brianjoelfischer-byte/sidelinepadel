import regions from './regions.json';

/**
 * Provincias (o estados) por país, con el nombre canónico que se guarda en
 * `venues.admin_area`.
 *
 * Una lista y no un campo libre: si cada uno escribe la provincia como quiere
 * ("Cba", "Córdoba Capital", "Pcia. de Córdoba"), agrupar por provincia deja de
 * servir para detectar duplicados. La misma lista la usa la bajada de
 * OpenStreetMap para traducir sus nombres oficiales.
 *
 * Por ahora solo Argentina. En los países sin lista, el formulario ofrece un
 * campo de texto.
 */
const REGIONS: Partial<Record<string, readonly string[]>> = regions;

export function regionsFor(countryCode: string): readonly string[] | null {
  return REGIONS[countryCode.toUpperCase()] ?? null;
}

export function isKnownRegion(countryCode: string, region: string): boolean {
  return regionsFor(countryCode)?.includes(region) ?? false;
}
