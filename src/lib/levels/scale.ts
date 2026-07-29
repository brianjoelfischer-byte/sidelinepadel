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
 * Categoría estimada a partir del nivel canónico.
 *
 * **Es una APROXIMACIÓN, no una categoría oficial.** Las categorías argentinas
 * salen de resultados en torneos federados: se asciende por puntos, no por
 * cómo jugás un martes. Alguien que nunca compitió no tiene categoría, y dos
 * personas con el mismo nivel real pueden estar en categorías distintas según
 * cuánto torneo hayan jugado.
 *
 * Sirve igual, y bastante: "4.2" no le dice nada a alguien que toda su vida
 * habló de cuartas y quintas. La estimación traduce a un vocabulario que ya
 * entiende, siempre etiquetada como lo que es.
 *
 * Anclajes usados, de fuentes del deporte:
 *   · 7ma — principiante, golpes básicos, dificultad con las paredes
 *   · 6ta — regularidad, control moderado de derecha y revés
 *   · 5ta/4ta — juega 2 o 3 veces por semana desde hace más de un año
 *   · 1ra — nivel profesional
 */
interface CategoryRange {
  max: number;
  label: string;
}

/** Argentina, Uruguay, Paraguay, Bolivia y Chile: numeradas al revés. */
const CATEGORIES_AR: CategoryRange[] = [
  { max: 1.9, label: '8va' },
  { max: 2.7, label: '7ma' },
  { max: 3.4, label: '6ta' },
  { max: 4.0, label: '5ta' },
  { max: 4.6, label: '4ta' },
  { max: 5.3, label: '3ra' },
  { max: 6.0, label: '2da' },
  { max: 7.0, label: '1ra' },
];

/** España: por nombre, no por número. */
const CATEGORIES_ES: CategoryRange[] = [
  { max: 1.9, label: 'Iniciación' },
  { max: 2.7, label: 'Iniciación alta' },
  { max: 3.4, label: 'Baja' },
  { max: 4.0, label: 'Media-Baja' },
  { max: 4.6, label: 'Media' },
  { max: 5.3, label: 'Media-Alta' },
  { max: 6.0, label: 'Alta' },
  { max: 7.0, label: 'Competición' },
];

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
 * Categoría estimada para el país, o `null` si ese país no usa categorías.
 * Cuando es `null`, la interfaz muestra la banda genérica traducida.
 *
 * Siempre se muestra etiquetada como aproximación: nunca como la categoría
 * oficial de nadie.
 */
export function localCategory(value: number, countryCode: string): string | null {
  const country = countryCode.toUpperCase();

  const table = SHARES_AR_SYSTEM.has(country)
    ? CATEGORIES_AR
    : country === 'ES'
      ? CATEGORIES_ES
      : null;

  if (!table) return null;

  const level = clampLevel(value);
  return table.find((range) => level <= range.max)?.label ?? null;
}

/**
 * Rango de nivel que cubre una categoría, para poder mostrar "4ta ≈ 4.1–4.6".
 * Sin eso la estimación parece más precisa de lo que es.
 */
export function categoryRange(
  value: number,
  countryCode: string,
): { min: number; max: number } | null {
  const country = countryCode.toUpperCase();
  const table = SHARES_AR_SYSTEM.has(country)
    ? CATEGORIES_AR
    : country === 'ES'
      ? CATEGORIES_ES
      : null;

  if (!table) return null;

  const level = clampLevel(value);
  const index = table.findIndex((range) => level <= range.max);
  if (index === -1) return null;

  const previous = table[index - 1];
  return {
    min: previous ? clampLevel(previous.max + 0.1) : LEVEL_MIN,
    max: table[index]!.max,
  };
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
