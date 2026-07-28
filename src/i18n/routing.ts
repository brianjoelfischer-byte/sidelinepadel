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
