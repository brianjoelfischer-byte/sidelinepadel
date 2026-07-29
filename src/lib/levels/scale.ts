/**
 * Escala de nivel · §11 del BLUEPRINT.
 *
 * "8va a 1ra" es el sistema de categorías de Argentina, Uruguay y parte de
 * España. **No es universal**: Escandinavia usa 1–7, Playtomic usa 0–7, y en
 * Estados Unidos se piensa en términos de tenis.
 *
 * Por eso adentro todo es una escala canónica 1.0–7.0 con un decimal, y la
 * categoría local es solo presentación. La comparación, el matchmaking y las
 * estadísticas usan SIEMPRE el valor canónico — eso es lo que permite que un
 * jugador argentino y uno sueco aparezcan en el mismo turno sin traducir nada
 * a mano.
 */

export const LEVEL_MIN = 1.0;
export const LEVEL_MAX = 7.0;
export const LEVEL_STEP = 0.1;

/** Tramos de la escala canónica. El orden importa: se busca el primero que entra. */
const BANDS = [
  { max: 1.9, key: 'beginner' },
  { max: 2.9, key: 'improver' },
  { max: 3.9, key: 'intermediate' },
  { max: 4.9, key: 'advanced' },
  { max: 5.9, key: 'expert' },
  { max: 7.0, key: 'elite' },
] as const;

export type LevelBandKey = (typeof BANDS)[number]['key'];

/**
 * Categoría local por país. La etiqueta es cosmética: dos jugadores con el
 * mismo valor canónico son equivalentes aunque su país los llame distinto.
 */
const LOCAL_CATEGORIES: Record<string, Partial<Record<LevelBandKey, string>>> = {
  // Argentina, Uruguay, Paraguay, Bolivia, Chile — categorías numeradas al revés
  AR: {
    beginner: '8va',
    improver: '7ma / 6ta',
    intermediate: '5ta / 4ta',
    advanced: '3ra',
    expert: '2da',
    elite: '1ra',
  },
  // España — categorías por nombre
  ES: {
    beginner: 'Iniciación',
    improver: 'Baja',
    intermediate: 'Media',
    advanced: 'Media-Alta',
    expert: 'Alta',
    elite: 'Competición',
  },
};

/** Países que comparten el sistema de categorías argentino. */
const SHARES_AR_SYSTEM = new Set(['AR', 'UY', 'PY', 'BO', 'CL']);

export function clampLevel(value: number): number {
  if (Number.isNaN(value)) return LEVEL_MIN;
  const clamped = Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, value));
  // Un decimal: la escala no distingue más fino que eso y guardar 4.37 daría
  // una falsa sensación de precisión.
  return Math.round(clamped * 10) / 10;
}

export function levelBand(value: number): LevelBandKey {
  const level = clampLevel(value);
  for (const band of BANDS) {
    if (level <= band.max) return band.key;
  }
  return 'elite';
}

/**
 * Etiqueta local del nivel, o `null` si el país no tiene un sistema propio.
 * Cuando es `null`, la interfaz muestra la banda genérica traducida.
 */
export function localCategory(value: number, countryCode: string): string | null {
  const country = countryCode.toUpperCase();
  const table = SHARES_AR_SYSTEM.has(country)
    ? LOCAL_CATEGORIES.AR
    : LOCAL_CATEGORIES[country];

  return table?.[levelBand(value)] ?? null;
}

/**
 * Banda de nivel por defecto para un turno · §12.5.
 *
 * `[nivel − 0.25, nivel + 0.75]`. Es el rango de Playtomic y funciona: tolera
 * poco por abajo y bastante por arriba, porque jugar contra alguien mejor es
 * lo que hace progresar.
 */
export function defaultLevelBand(level: number): { min: number; max: number } {
  return {
    min: clampLevel(level - 0.25),
    max: clampLevel(level + 0.75),
  };
}

export function isWithinBand(level: number, min: number, max: number): boolean {
  const value = clampLevel(level);
  return value >= clampLevel(min) && value <= clampLevel(max);
}

/** Formatea con un decimal, en el locale que corresponda (4,0 en es · 4.0 en en). */
export function formatLevel(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(clampLevel(value));
}
