import { defineRouting } from 'next-intl/routing';

/**
 * Idiomas de la v1. La estructura soporta más (pt, it, fr) — se agregan
 * acá cuando exista la traducción real, no antes. Ver §11 del BLUEPRINT.
 */
export const locales = ['es', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'es';

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Prefijo siempre visible: /es/turnos, /en/turnos.
  // Sin prefijo el locale por defecto queda ambiguo para SEO y para el cache.
  localePrefix: 'always',
});

/**
 * Estrecha el `locale` que llega por params a nuestro tipo.
 *
 * Next tipa los params de página como `string`, pero el layout de `[locale]`
 * ya devuelve 404 ante un idioma desconocido: cuando esto corre, el valor es
 * válido. El fallback existe solo para satisfacer al compilador.
 */
export function toLocale(value: string): Locale {
  return (locales as readonly string[]).includes(value)
    ? (value as Locale)
    : defaultLocale;
}
