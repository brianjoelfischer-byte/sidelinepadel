import { useTranslations } from 'next-intl';

import { setWinner, type SetScore } from '@/lib/sessions/score';

/**
 * Marcador compacto para listas cortas (el panel): un casillero por set.
 *
 * El tablero completo (`Scoreboard`) ocupa demasiado para tres partidos en el
 * inicio, pero volver al "6-3, 4-6, 7-5" en texto corrido es lo que el owner
 * marcó como confuso. Acá cada set va separado, con tu número primero y en
 * negrita, y el fondo dice quién se lo llevó. El lector de pantalla oye
 * "Set 1: 6 a 3, ganado".
 */
export function SetChips({ sets }: { sets: SetScore[] }) {
  const t = useTranslations('session');

  return (
    <ol className="flex flex-wrap gap-1.5">
      {sets.map((set, i) => {
        const winner = setWinner(set);
        const tone =
          winner === 'me'
            ? 'border-win/30 bg-win/10'
            : winner === 'opp'
              ? 'border-loss/30 bg-loss/10'
              : 'border-border bg-bg-elevated';
        const state =
          winner === 'me'
            ? t('setState.won')
            : winner === 'opp'
              ? t('setState.lost')
              : t('setState.incomplete');
        return (
          <li
            key={i}
            className={`rounded-lg border px-2.5 py-1 font-display text-sm tabular-nums ${tone}`}
          >
            <span aria-hidden="true">
              <span className="font-bold text-fg">{set.me}</span>
              <span className="text-fg-muted">–{set.opp}</span>
            </span>
            <span className="sr-only">
              {t('setNumber', { n: i + 1 })}: {set.me}–{set.opp}, {state}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
