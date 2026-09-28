import { useTranslations } from 'next-intl';

import type { Result } from '@/lib/stats/summary';

/**
 * Etiqueta de resultado. Una sola para el panel y el historial, así "Victoria"
 * se ve igual en todos lados.
 *
 * Texto y símbolo además del color (§10): quien no distingue verde de rojo
 * igual lee "Victoria" y ve la flecha.
 */
const STYLE: Record<Result | 'training', string> = {
  win: 'bg-win/15 text-win',
  loss: 'bg-loss/15 text-loss',
  draw: 'bg-bg-elevated text-fg-secondary',
  training: 'bg-info/10 text-info',
};

const SYMBOL: Record<Result | 'training', string> = {
  win: '▲',
  loss: '▼',
  draw: '=',
  training: '●',
};

export function ResultBadge({ result }: { result: Result | null }) {
  const t = useTranslations('session');
  const key = result ?? 'training';
  const label = result ? t(`result.${result}`) : t('kind.training');

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-3 py-1 text-xs font-semibold ${STYLE[key]}`}
    >
      <span aria-hidden="true" className="text-[9px]">
        {SYMBOL[key]}
      </span>
      {label}
    </span>
  );
}

/**
 * Forma reciente: un casillero por partido, del más nuevo al más viejo.
 * La letra va adentro (G/P/E), así no depende del color.
 */
export function FormStrip({ form }: { form: Result[] }) {
  const t = useTranslations('panel');
  if (form.length === 0) return null;

  return (
    <ol className="flex gap-1.5" aria-label={t('form')}>
      {form.map((result, i) => (
        <li
          key={i}
          className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-bold ${STYLE[result]}`}
        >
          <span aria-hidden="true">{t(`formLetter.${result}`)}</span>
          <span className="sr-only">{t(`formWord.${result}`)}</span>
        </li>
      ))}
    </ol>
  );
}
