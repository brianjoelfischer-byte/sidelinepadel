/**
 * Resumen del panel: cuánto jugaste, cuánto ganaste, cómo venís.
 *
 * Funciones puras sobre las sesiones ya leídas de la base: sin fecha del
 * sistema adentro (se pasa `today`), así los tests no dependen de cuándo se
 * corren. El bloque 6 (estadísticas completas) parte de acá.
 */

export type Result = 'win' | 'loss' | 'draw';

export interface SessionLike {
  kind: 'match' | 'quick_match' | 'training';
  played_on: string; // YYYY-MM-DD
  created_at?: string;
  result: Result | null;
}

export interface Summary {
  matches: number;
  trainings: number;
  wins: number;
  losses: number;
  draws: number;
  /** 0 a 1. `null` sin partidos: un "0 %" diría que perdiste todos. */
  winRate: number | null;
  /** Racha actual. Un empate la corta: no es ni ganar ni perder. */
  streak: { result: 'win' | 'loss'; count: number } | null;
  /** Últimos resultados, del más reciente al más viejo. */
  form: Result[];
  matchesThisMonth: number;
}

const isMatch = (s: SessionLike) => s.kind === 'match' || s.kind === 'quick_match';

/** Más reciente primero. Dos partidos del mismo día: el cargado último va antes. */
function byRecency(a: SessionLike, b: SessionLike): number {
  if (a.played_on !== b.played_on) return a.played_on < b.played_on ? 1 : -1;
  return (b.created_at ?? '').localeCompare(a.created_at ?? '');
}

export function summarize(
  sessions: SessionLike[],
  { today, formSize = 5 }: { today: string; formSize?: number },
): Summary {
  const matches = sessions
    .filter(isMatch)
    .filter((s): s is SessionLike & { result: Result } => s.result !== null)
    .sort(byRecency);

  const wins = matches.filter((s) => s.result === 'win').length;
  const losses = matches.filter((s) => s.result === 'loss').length;
  const draws = matches.filter((s) => s.result === 'draw').length;

  let streak: Summary['streak'] = null;
  const latest = matches[0];
  if (latest && latest.result !== 'draw') {
    let count = 0;
    for (const s of matches) {
      if (s.result !== latest.result) break;
      count += 1;
    }
    streak = { result: latest.result, count };
  }

  const month = today.slice(0, 7);

  return {
    matches: matches.length,
    trainings: sessions.filter((s) => s.kind === 'training').length,
    wins,
    losses,
    draws,
    winRate: matches.length > 0 ? wins / matches.length : null,
    streak,
    form: matches.slice(0, formSize).map((s) => s.result),
    matchesThisMonth: matches.filter((s) => s.played_on.startsWith(month)).length,
  };
}
