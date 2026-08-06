/**
 * Marcador de un partido de pádel.
 *
 * El resultado NO se ingresa: se deriva de los sets. Pedirlo aparte permitiría
 * cargar "gané" con un 3-6 3-6, y esa contradicción después ensucia todas las
 * estadísticas sin que nadie sepa por qué.
 */

export interface SetScore {
  me: number;
  opp: number;
}

export type MatchResult = 'win' | 'loss' | 'draw';

export const MAX_SETS = 5;

/**
 * Un set válido de pádel.
 *
 * Reglas reales del deporte:
 *  · se gana con 6 y dos de diferencia (6-0 … 6-4)
 *  · con 5-5 se sigue hasta 7-5
 *  · con 6-6 va tie-break, que se anota 7-6
 *
 * Se permite hasta 9 por si alguien anota un set largo sin tie-break, que en
 * amateur pasa. Lo que no se permite es un marcador imposible.
 */
export function isValidSet(set: SetScore): boolean {
  const { me, opp } = set;

  if (!Number.isInteger(me) || !Number.isInteger(opp)) return false;
  if (me < 0 || opp < 0) return false;
  if (me > 9 || opp > 9) return false;

  const high = Math.max(me, opp);
  const low = Math.min(me, opp);

  // Nadie gana un set con menos de 6 juegos.
  if (high < 6) return false;

  // 6 con dos de diferencia, o 7-5 y 7-6.
  if (high === 6) return low <= 4;
  if (high === 7) return low === 5 || low === 6;

  // Sets largos: siempre dos de diferencia.
  return high - low === 2;
}

/**
 * Resultado a partir de los sets. `null` si el marcador no permite decidirlo.
 *
 * Un partido abandonado o suspendido puede quedar 1-1: eso es un empate, no un
 * dato inválido. Pasa de verdad en amateur, cuando se acaba el turno de cancha.
 */
export function resultFromSets(sets: SetScore[]): MatchResult | null {
  if (sets.length === 0) return null;
  if (sets.length > MAX_SETS) return null;
  if (!sets.every(isValidSet)) return null;

  let mine = 0;
  let theirs = 0;

  for (const set of sets) {
    if (set.me > set.opp) mine += 1;
    else theirs += 1;
  }

  if (mine > theirs) return 'win';
  if (theirs > mine) return 'loss';
  return 'draw';
}

/** Juegos ganados y perdidos en total. Alimenta las estadísticas del bloque 6. */
export function gameTotals(sets: SetScore[]): { for: number; against: number } {
  return sets.reduce(
    (acc, set) => ({ for: acc.for + set.me, against: acc.against + set.opp }),
    { for: 0, against: 0 },
  );
}

/** Marcador legible: "6-3, 4-6, 7-5". */
export function formatSets(sets: SetScore[]): string {
  return sets.map((set) => `${set.me}-${set.opp}`).join(', ');
}

/**
 * ¿Fue una remontada? Se perdió el primer set y aun así se ganó el partido.
 * Lo usa el trofeo "El rey de la remontada" del bloque 12.
 */
export function isComeback(sets: SetScore[]): boolean {
  const first = sets[0];
  if (!first || first.me >= first.opp) return false;
  return resultFromSets(sets) === 'win';
}
