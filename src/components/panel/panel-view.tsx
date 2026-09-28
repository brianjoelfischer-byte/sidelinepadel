import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { PlusIcon } from '@/components/nav/icons';
import { FormStrip, ResultBadge } from '@/components/sessions/result-badge';
import { SetChips } from '@/components/sessions/set-chips';
import { VenueLink } from '@/components/sessions/venue-link';
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
  const tSession = useTranslations('session');
  const format = useFormatter();

  const empty = summary.matches === 0 && summary.trainings === 0;

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 lg:px-10 lg:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-fg-muted first-letter:uppercase">
            {format.dateTime(new Date(`${today}T12:00:00Z`), {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <h1 className="mt-1 text-3xl sm:text-4xl">{t('greeting', { name: firstName })}</h1>
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
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
                <span className="text-xs font-semibold uppercase tracking-widest text-fg-muted">
                  {t('form')}
                </span>
                <FormStrip form={summary.form} />
              </div>
            ) : null}
          </section>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_22rem]">
            {/* ── Últimos partidos ───────────────────────────────────── */}
            <section aria-labelledby="recientes">
              <div className="flex items-center justify-between">
                <h2 id="recientes" className="text-xl">
                  {t('recent')}
                </h2>
                <Link
                  href="/sesiones"
                  className="text-sm font-semibold text-accent underline-offset-4 hover:underline"
                >
                  {t('seeAll')}
                </Link>
              </div>

              <ul className="mt-4 space-y-3">
                {recent.map((s) => (
                  <li key={s.id} className="rounded-card border border-border bg-bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-fg-secondary">
                          {format.dateTime(new Date(`${s.playedOn}T12:00:00Z`), {
                            day: 'numeric',
                            month: 'short',
                          })}
                          <span className="text-fg-muted">
                            {' · '}
                            {s.kind === 'match'
                              ? tSession('kind.match')
                              : s.kind === 'quick_match'
                                ? tSession('kind.quick')
                                : tSession('kind.training')}
                          </span>
                        </p>
                        <div className="mt-1">
                          <VenueLink venue={s.venue} label={tSession('openInMaps')} />
                        </div>
                      </div>
                      <ResultBadge result={s.result} />
                    </div>
                    {s.sets && s.sets.length > 0 ? (
                      <div className="mt-3">
                        <SetChips sets={s.sets} />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>

            {/* ── Nivel ──────────────────────────────────────────────── */}
            <section aria-labelledby="nivel">
              <h2 id="nivel" className="text-xl">
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
  const valueColor = accent
    ? 'text-accent'
    : tone === 'win'
      ? 'text-win'
      : tone === 'loss'
        ? 'text-loss'
        : 'text-fg';
  return (
    <div className="rounded-card border border-border bg-bg-surface p-4">
      <dt className="text-xs font-semibold uppercase tracking-widest text-fg-muted">{label}</dt>
      <dd className={`mt-2 font-display text-3xl font-bold tabular-nums ${valueColor}`}>{value}</dd>
      {hint ? <dd className="mt-1 text-xs text-fg-secondary">{hint}</dd> : null}
    </div>
  );
}

function EmptyState() {
  const t = useTranslations('panel');
  return (
    <section className="mt-10 rounded-card border border-dashed border-border bg-bg-surface px-6 py-12 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent/10 text-accent">
        <PlusIcon className="h-8 w-8" />
      </span>
      <h2 className="mt-6 text-2xl">{t('emptyTitle')}</h2>
      <p className="mx-auto mt-3 max-w-sm text-fg-secondary">{t('emptyBody')}</p>
      <Link
        href="/sesiones/nueva"
        className="touch-target mt-8 inline-flex items-center gap-2 rounded-pill bg-accent px-6 font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
      >
        <PlusIcon className="h-5 w-5" />
        {t('emptyCta')}
      </Link>
    </section>
  );
}
