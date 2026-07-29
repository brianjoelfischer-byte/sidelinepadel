/**
 * Países del seed inicial · §13 del BLUEPRINT.
 *
 * El nombre no se guarda acá: se traduce con `Intl.DisplayNames` en el idioma
 * del usuario. Mantener una lista de nombres traducidos a mano sería trabajo
 * duplicado y quedaría desactualizada.
 */
export const SUPPORTED_COUNTRIES = [
  // Cono Sur
  'AR', 'CL', 'UY', 'PY', 'BO',
  // Brasil
  'BR',
  // Andina y Caribe
  'PE', 'EC', 'CO', 'VE',
  // Centroamérica y México
  'MX', 'CR', 'PA', 'GT', 'SV', 'HN', 'NI', 'DO', 'CU', 'PR',
  // Norteamérica
  'US',
  // Europa de referencia
  'ES', 'IT', 'PT', 'FR', 'SE',
  // África
  'ZA',
] as const;

export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number];

/** Bandera como emoji, derivada del código ISO — sin imágenes ni assets. */
export function countryFlag(code: string): string {
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return '';

  // Los indicadores regionales viven 0x1F1E6 arriba de 'A'.
  const OFFSET = 0x1f1e6 - 'A'.charCodeAt(0);
  return String.fromCodePoint(
    upper.charCodeAt(0) + OFFSET,
    upper.charCodeAt(1) + OFFSET,
  );
}

/** Países ordenados alfabéticamente según el idioma que se esté usando. */
export function countryOptions(
  locale: string,
): { code: string; name: string; flag: string }[] {
  const display = new Intl.DisplayNames([locale], { type: 'region' });

  return SUPPORTED_COUNTRIES.map((code) => ({
    code,
    name: display.of(code) ?? code,
    flag: countryFlag(code),
  })).sort((a, b) => a.name.localeCompare(b.name, locale));
}
