import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { ResultBadge } from '@/components/sessions/result-badge';
import { Scoreboard } from '@/components/sessions/scoreboard';
import { VenueLink } from '@/components/sessions/venue-link';
import type { SetScore } from '@/lib/sessions/score';
import type { VenueLabel } from '@/lib/sessions/venue-names';
import type { Result } from '@/lib/stats/summary';

/**
 * Un partido o entrenamiento, como la tarjeta de resultado de una
 * transmisión: arriba la fecha y el tipo en mayúsculas chicas con el
 * resultado en un chip, el club, y el marcador set por set en su recuadro.
 *
 * Una sola para el panel y el historial, así un partido se ve igual en los
 * dos lados.
 */
export function SessionCard({
  playedOn,
  kind,
  result,
  sets,
  venue,
  notes,
  footer,
}: {
  playedOn: string;
  kind: 'match' | 'quick_match' | 'training';
  result: Result | null;
  sets: SetScore[] | null;
  venue: VenueLabel | null;
  notes?: string | null;
  /** Acciones al pie, como borrar. */
  footer?: ReactNode;
}) {
  const t = useTranslations('session');
  const format = useFormatter();

  const kindLabel =
    kind === 'match' ? t('kind.match') : kind === 'quick_match' ? t('kind.quick') : t('kind.training');

  return (
    <article className="card-glass overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <p className="eyebrow text-fg-secondary">
            {format.dateTime(new Date(`${playedOn}T12:00:00Z`), {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
            <span className="text-accent"> | </span>
            {kindLabel}
          </p>
          <div className="mt-1.5">
            <VenueLink venue={venue} label={t('openInMaps')} />
          </div>
        </div>
        <ResultBadge result={result} />
      </div>

      {sets && sets.length > 0 ? (
        <div className="mx-3 mt-3 rounded-xl border border-white/10 bg-black/60 px-3 py-2">
          <Scoreboard sets={sets} />
        </div>
      ) : null}

      {notes ? <p className="mt-3 px-4 text-sm text-fg-secondary">{notes}</p> : null}

      {footer ? (
        <div className="mt-3 flex justify-end border-t border-white/10 px-4 py-2">{footer}</div>
      ) : (
        <div className="h-4" />
      )}
    </article>
  );
}
