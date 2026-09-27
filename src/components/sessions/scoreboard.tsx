import { useTranslations } from 'next-intl';

import { setWinner, setsWon, type SetScore } from '@/lib/sessions/score';

/**
 * Marcador como el de una transmisión: una fila por lado, una columna por set.
 *
 *              1   2   3 │ Sets
 *   Vos        6   4   7 │  2
 *   Rivales    3   6   5 │  1
 *
 * Reemplaza al "6-3, 4-6, 7-5" en texto corrido, donde había que saber que el
 * primer número es el propio para entender quién ganó cada set.
 *
 * El ganador de cada set va en negrita y a color pleno; el perdedor, apagado.
 * La diferencia no depende solo del color (§10): cambia también el peso, y el
 * `<caption>` lo dice en palabras para el lector de pantalla.
 */
export function Scoreboard({ sets }: { sets: SetScore[] }) {
  const t = useTranslations('session');
  const won = setsWon(sets);

  const rows = [
    { side: 'me' as const, label: t('you'), total: won.me },
    { side: 'opp' as const, label: t('them'), total: won.opp },
  ];

  const matchWinner = won.me > won.opp ? 'me' : won.opp > won.me ? 'opp' : null;

  return (
    <table className="w-full max-w-sm border-collapse font-display tabular-nums">
      <caption className="sr-only">
        {t('scoreboard.caption', { me: won.me, opp: won.opp })}
      </caption>

      <thead>
        <tr className="text-xs text-fg-muted">
          <th scope="col" className="w-full text-left font-normal">
            <span className="sr-only">{t('scoreboard.side')}</span>
          </th>
          {sets.map((_, index) => (
            <th key={index} scope="col" className="px-2 pb-1 text-center font-normal">
              {/* Visible solo el número; el lector de pantalla oye "Set 1". */}
              <span aria-hidden="true">{index + 1}</span>
              <span className="sr-only">{t('setNumber', { n: index + 1 })}</span>
            </th>
          ))}
          <th
            scope="col"
            className="border-l border-border pb-1 pl-3 text-center font-normal"
          >
            {t('scoreboard.sets')}
          </th>
        </tr>
      </thead>

      <tbody>
        {rows.map(({ side, label, total }) => (
          <tr key={side} className="border-t border-border first:border-t-0">
            <th
              scope="row"
              className={
                matchWinner === side
                  ? 'py-1.5 pr-4 text-left font-sans text-sm font-semibold text-fg'
                  : 'py-1.5 pr-4 text-left font-sans text-sm font-normal text-fg-secondary'
              }
            >
              {label}
            </th>

            {sets.map((set, index) => {
              const games = side === 'me' ? set.me : set.opp;
              const wonSet = setWinner(set) === side;
              return (
                <td
                  key={index}
                  className={
                    wonSet
                      ? 'px-2 py-1.5 text-center text-lg font-bold text-fg'
                      : 'px-2 py-1.5 text-center text-lg font-normal text-fg-muted'
                  }
                >
                  {games}
                </td>
              );
            })}

            <td
              className={
                matchWinner === side
                  ? 'border-l border-border py-1.5 pl-3 text-center text-lg font-bold text-accent'
                  : 'border-l border-border py-1.5 pl-3 text-center text-lg font-normal text-fg-muted'
              }
            >
              {total}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
