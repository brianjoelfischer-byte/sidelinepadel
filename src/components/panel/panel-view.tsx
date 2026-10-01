import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { DisplayTitle } from '@/components/display-title';
import { PlusIcon } from '@/components/nav/icons';
import { FormStrip } from '@/components/sessions/result-badge';
import { SessionCard } from '@/components/sessions/session-card';
import { Link } from '@/i18n/navigation';
import type { SetScore } from '@/lib/sessions/score';
import type { VenueLabel } from '@/lib/sessions/venue-names';
import type { Result, Summary } from '@/lib/stats/summary';

/**
 * El inicio de la app: cómo venís, de un vistazo.
 *
 * Solo presentación: recibe los datos ya calculados. La página los lee de la
 * base; separado así se puede probar en el navegador con datos de ejemplo,
 * sin sesión iniciada.
 */

export interface RecentSession {
  id: string;
  kind: 'match' | 'quick_match' | 'training';
  playedOn: string;
  result: Result | null;
  sets: SetScore[] | null;
  venue: VenueLabel | null;
}

export function PanelView({
  firstName,
  today,
  summary,
  recent,
  level,
}: {
  firstName: string;
  today: string;
  summary: Summary;
  recent: RecentSession[];
  /** La tarjeta de nivel, ya armada: es un componente de servidor aparte. */
  level: ReactNode;
}) {
  const t = useTranslations('panel');
  const format = useFormatter();

  const empty = summary.matches === 0 && summary.trainings === 0;

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 lg:px-10 lg:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow text-accent">
            {format.dateTime(new Date(`${today}T12:00:00Z`), {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <DisplayTitle
            text={t('greeting', { name: firstName })}
            className="mt-2 text-5xl sm:text-6xl"
          />
        </div>
      </header>

      {empty ? (
        <EmptyState />
      ) : (
        <>
          {/* ── Resumen ──────────────────────────────────────────────── */}
          <section aria-labelledby="resumen" className="mt-8">
            <h2 id="resumen" className="sr-only">
              {t('summary')}
            </h2>
            <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
              <Stat label={t('matches')} value={format.number(summary.matches)} />
              <Stat
                label={t('winRate')}
                value={
                  summary.winRate === null
                    ? '—'
                    : format.number(summary.winRate, { style: 'percent', maximumFractionDigits: 0 })
                }
                hint={
                  summary.matches > 0
                    ? t('record', { wins: summary.wins, losses: summary.losses })
                    : undefined
                }
                accent
              />
              <Stat
                label={t('streak')}
                value={summary.streak ? `${summary.streak.count}` : '—'}
                hint={
                  summary.streak
                    ? summary.streak.result === 'win'
                      ? t('streakWin', { count: summary.streak.count })
                      : t('streakLoss', { count: summary.streak.count })
                    : t('noStreak')
                }
                tone={summary.streak?.result}
              />
              <Stat label={t('thisMonth')} value={format.number(summary.matchesThisMonth)} />
            </dl>

            {summary.form.length > 0 ? (
              <div className="mt-4 flex items-center gap-3">
                <span className="eyebrow text-fg-muted">
                  {t('form')}
                </span>
                <FormStrip form={summary.form} />
              </div>
            ) : null}
          </section>

          <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
            {/* ── Últimos partidos ───────────────────────────────────── */}
            <section aria-labelledby="recientes">
              <div className="flex items-center justify-between">
                <h2 id="recientes" className="text-2xl">
                  {t('recent')}
                </h2>
                <Link
                  href="/sesiones"
                  className="eyebrow text-accent underline-offset-4 hover:underline"
                >
                  {t('seeAll')}
                </Link>
              </div>

              <ul className="mt-4 space-y-3">
                {recent.map((s) => (
                  <li key={s.id}>
                    <SessionCard
                      playedOn={s.playedOn}
                      kind={s.kind}
                      result={s.result}
                      sets={s.sets}
                      venue={s.venue}
                    />
                  </li>
                ))}
              </ul>
            </section>

            {/* ── Nivel ──────────────────────────────────────────────── */}
            <section aria-labelledby="nivel">
              <h2 id="nivel" className="text-2xl">
                {t('level')}
              </h2>
              <div className="mt-4">{level}</div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
  accent = false,
  tone,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  accent?: boolean;
  tone?: 'win' | 'loss' | undefined;
}) {
  // La tarjeta destacada es dorada, como las de la tele; el texto va blanco.
  const valueColor = accent
    ? 'text-white'
    : tone === 'win'
      ? 'text-win'
      : tone === 'loss'
        ? 'text-loss'
        : 'text-fg';
  return (
    <div
      className={
        accent
          ? 'bg-gold-card rounded-card border border-white/40 p-4'
          : 'card-glass p-4'
      }
    >
      <dt className={`eyebrow ${accent ? 'text-white' : 'text-fg-muted'}`}>{label}</dt>
      <dd
        className={`mt-1 font-display text-4xl font-bold leading-none tabular-nums sm:text-5xl ${valueColor}`}
      >
        {value}
      </dd>
      {hint ? (
        <dd className={`mt-2 text-sm ${accent ? 'text-white' : 'text-fg-secondary'}`}>{hint}</dd>
      ) : null}
    </div>
  );
}

function EmptyState() {
  const t = useTranslations('panel');
  return (
    <section className="card-glass mt-10 px-6 py-12 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-accent/60 bg-black text-accent">
        <PlusIcon className="h-8 w-8" />
      </span>
      <h2 className="mt-6 text-2xl">{t('emptyTitle')}</h2>
      <p className="mx-auto mt-3 max-w-sm text-fg-secondary">{t('emptyBody')}</p>
      <Link
        href="/sesiones/nueva"
        className="btn-gold touch-target mt-8 gap-2 px-6"
      >
        <PlusIcon className="h-5 w-5" />
        {t('emptyCta')}
      </Link>
    </section>
  );
}
