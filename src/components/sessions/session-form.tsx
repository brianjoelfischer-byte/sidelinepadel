'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { createSession } from '@/actions/sessions';
import { resultFromSets, type SetScore } from '@/lib/sessions/score';
import { useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

type Kind = 'match' | 'quick_match' | 'training';
type Team = 'mine' | 'opponent';

interface PlayerDraft {
  guestName: string;
  team: Team;
  perceivedLevel: number | null;
}

type ErrorKey =
  | 'invalid_input'
  | 'invalid_score'
  | 'future_date'
  | 'not_authenticated'
  | 'no_profile'
  | 'unavailable';

const today = () => new Date().toISOString().slice(0, 10);

export function SessionForm({ locale: _locale }: { locale: Locale }) {
  const t = useTranslations('session');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [kind, setKind] = useState<Kind>('match');
  const [playedOn, setPlayedOn] = useState(today());
  const [venue, setVenue] = useState('');
  const [sets, setSets] = useState<SetScore[]>([{ me: 6, opp: 3 }]);
  const [quickResult, setQuickResult] = useState<'win' | 'loss' | 'draw'>('win');
  const [players, setPlayers] = useState<PlayerDraft[]>([]);
  const [side, setSide] = useState<'drive' | 'reves' | null>(null);
  const [selfRating, setSelfRating] = useState(7);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<ErrorKey | null>(null);

  /**
   * El resultado se muestra en vivo y no se puede editar: sale del marcador.
   * Que sea visible mientras cargás es la forma de detectar un set mal tipeado
   * antes de guardar, en vez de descubrirlo en las estadísticas meses después.
   */
  const derived = kind === 'match' ? resultFromSets(sets) : null;

  function updateSet(index: number, field: keyof SetScore, value: number) {
    setSets((current) =>
      current.map((set, i) => (i === index ? { ...set, [field]: value } : set)),
    );
  }

  function submit() {
    setError(null);

    const participants = players
      .filter((p) => p.guestName.trim() !== '')
      .map((p) => ({
        guestName: p.guestName.trim(),
        team: p.team,
        ...(p.perceivedLevel !== null ? { perceivedLevel: p.perceivedLevel } : {}),
      }));

    const common = {
      playedOn,
      participants,
      ...(venue.trim() ? { venueFreetext: venue.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(side ? { sidePlayed: side } : {}),
      ...(kind !== 'training' ? { selfRating } : {}),
    };

    const payload =
      kind === 'match'
        ? { ...common, kind: 'match' as const, sets }
        : kind === 'quick_match'
          ? { ...common, kind: 'quick_match' as const, result: quickResult }
          : { ...common, kind: 'training' as const };

    startTransition(async () => {
      const result = await createSession(payload);
      if (result.ok) {
        router.push('/panel');
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Tipo de sesión */}
      <fieldset>
        <legend className="sr-only">{t('title')}</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['match', t('kind.match')],
              ['quick_match', t('kind.quick')],
              ['training', t('kind.training')],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              aria-pressed={kind === value}
              className={
                kind === value
                  ? 'touch-target rounded-pill bg-accent px-5 text-sm font-semibold text-accent-ink'
                  : 'touch-target rounded-pill border border-border px-5 text-sm font-semibold text-fg-secondary'
              }
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-fg-muted">
          {kind === 'match'
            ? t('kindHint.match')
            : kind === 'quick_match'
              ? t('kindHint.quick')
              : t('kindHint.training')}
        </p>
      </fieldset>

      {/* Cuándo y dónde */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('date')} htmlFor="playedOn">
          <input
            id="playedOn"
            type="date"
            value={playedOn}
            max={today()}
            onChange={(e) => setPlayedOn(e.target.value)}
            className="touch-target w-full rounded-card border border-border bg-bg-surface px-4 py-3"
          />
        </Field>

        <Field label={t('venue')} htmlFor="venue">
          <input
            id="venue"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder={t('venuePlaceholder')}
            maxLength={120}
            className="touch-target w-full rounded-card border border-border bg-bg-surface px-4 py-3"
          />
        </Field>
      </div>

      {/* Marcador */}
      {kind === 'match' ? (
        <section className="rounded-card border border-border bg-bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-fg-secondary">
              {t('score')}
            </h2>
            {derived ? (
              <span
                className={
                  derived === 'win'
                    ? 'rounded-pill bg-win/15 px-3 py-1 text-sm font-semibold text-win'
                    : derived === 'loss'
                      ? 'rounded-pill bg-loss/15 px-3 py-1 text-sm font-semibold text-loss'
                      : 'rounded-pill bg-bg-elevated px-3 py-1 text-sm font-semibold text-fg-secondary'
                }
              >
                {t(`result.${derived}` as 'result.win')}
              </span>
            ) : (
              <span className="text-xs text-accent-2">{t('errors.invalid_score')}</span>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {sets.map((set, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="w-14 text-xs uppercase tracking-wider text-fg-muted">
                  {t('setNumber', { n: index + 1 })}
                </span>
                <GameInput
                  label={`${t('you')} · ${t('setNumber', { n: index + 1 })}`}
                  value={set.me}
                  onChange={(v) => updateSet(index, 'me', v)}
                />
                <span className="text-fg-muted">–</span>
                <GameInput
                  label={`${t('them')} · ${t('setNumber', { n: index + 1 })}`}
                  value={set.opp}
                  onChange={(v) => updateSet(index, 'opp', v)}
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            {sets.length < 5 ? (
              <button
                type="button"
                onClick={() => setSets((s) => [...s, { me: 6, opp: 4 }])}
                className="touch-target rounded-pill border border-border px-4 text-sm font-semibold"
              >
                {t('addSet')}
              </button>
            ) : null}
            {sets.length > 1 ? (
              <button
                type="button"
                onClick={() => setSets((s) => s.slice(0, -1))}
                className="touch-target rounded-pill border border-border px-4 text-sm font-semibold text-fg-secondary"
              >
                {t('removeSet')}
              </button>
            ) : null}
          </div>

          <p className="mt-3 text-xs text-fg-muted">{t('result.auto')}</p>
        </section>
      ) : null}

      {/* Partido rápido: solo el resultado */}
      {kind === 'quick_match' ? (
        <Choice
          label={t('result.label')}
          value={quickResult}
          onChange={setQuickResult}
          options={[
            { value: 'win' as const, label: t('result.win') },
            { value: 'loss' as const, label: t('result.loss') },
            { value: 'draw' as const, label: t('result.draw') },
          ]}
        />
      ) : null}

      {/* Jugadores */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-fg-secondary">
          {t('players')}
        </h2>
        <p className="mt-1 text-xs text-fg-muted">{t('playersHint')}</p>

        <div className="mt-4 space-y-3">
          {players.map((player, index) => (
            <div
              key={index}
              className="rounded-card border border-border bg-bg-surface p-4"
            >
              <div className="flex gap-2">
                <input
                  value={player.guestName}
                  onChange={(e) =>
                    setPlayers((current) =>
                      current.map((p, i) =>
                        i === index ? { ...p, guestName: e.target.value } : p,
                      ),
                    )
                  }
                  placeholder={t('playerName')}
                  aria-label={t('playerName')}
                  maxLength={60}
                  className="touch-target flex-1 rounded-card border border-border bg-bg-elevated px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    setPlayers((current) => current.filter((_, i) => i !== index))
                  }
                  aria-label={t('removeSet')}
                  className="touch-target rounded-pill border border-border px-3 text-sm text-fg-muted"
                >
                  ×
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(
                  [
                    ['mine', t('partner')],
                    ['opponent', t('opponents')],
                  ] as const
                ).map(([team, label]) => (
                  <button
                    key={team}
                    type="button"
                    onClick={() =>
                      setPlayers((current) =>
                        current.map((p, i) => (i === index ? { ...p, team } : p)),
                      )
                    }
                    aria-pressed={player.team === team}
                    className={
                      player.team === team
                        ? 'touch-target rounded-pill bg-accent px-4 text-xs font-semibold text-accent-ink'
                        : 'touch-target rounded-pill border border-border px-4 text-xs font-semibold text-fg-secondary'
                    }
                  >
                    {label}
                  </button>
                ))}

                {player.team === 'opponent' ? (
                  <label className="ml-auto flex items-center gap-2 text-xs text-fg-muted">
                    {t('theirLevel')}
                    <input
                      type="number"
                      min={1}
                      max={7}
                      step={0.1}
                      value={player.perceivedLevel ?? ''}
                      onChange={(e) =>
                        setPlayers((current) =>
                          current.map((p, i) =>
                            i === index
                              ? {
                                  ...p,
                                  perceivedLevel:
                                    e.target.value === ''
                                      ? null
                                      : Number(e.target.value),
                                }
                              : p,
                          ),
                        )
                      }
                      className="w-20 rounded-card border border-border bg-bg-elevated px-2 py-1 text-sm text-fg"
                    />
                  </label>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {players.length < 3 ? (
          <button
            type="button"
            onClick={() =>
              setPlayers((current) => [
                ...current,
                { guestName: '', team: 'opponent', perceivedLevel: null },
              ])
            }
            className="touch-target mt-3 rounded-pill border border-border px-4 text-sm font-semibold"
          >
            {t('addPlayer')}
          </button>
        ) : null}
      </section>

      {/* Detalle personal */}
      {kind !== 'training' ? (
        <div className="space-y-6">
          <Choice
            label={t('side.label')}
            value={side}
            onChange={setSide}
            options={[
              { value: 'drive' as const, label: t('side.drive') },
              { value: 'reves' as const, label: t('side.reves') },
            ]}
          />

          <Field label={`${t('selfRating')} · ${selfRating}/10`} htmlFor="selfRating">
            <input
              id="selfRating"
              type="range"
              min={1}
              max={10}
              value={selfRating}
              onChange={(e) => setSelfRating(Number(e.target.value))}
              className="w-full accent-[var(--color-accent)]"
            />
          </Field>
        </div>
      ) : null}

      <Field label={t('notes')} htmlFor="notes">
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('notesPlaceholder')}
          maxLength={160}
          rows={3}
          className="w-full rounded-card border border-border bg-bg-surface px-4 py-3"
        />
      </Field>

      {error ? (
        <p
          role="alert"
          className="rounded-card border border-loss/40 bg-loss/10 px-4 py-3 text-sm"
        >
          {t(`errors.${error}` as 'errors.unavailable')}
        </p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={isPending || (kind === 'match' && derived === null)}
        className="touch-target w-full rounded-pill bg-accent px-6 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? t('saving') : t('save')}
      </button>
    </div>
  );
}

function GameInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={9}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      className="touch-target w-16 rounded-card border border-border bg-bg-elevated px-3 py-2 text-center text-lg font-semibold"
    />
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-fg-secondary">
        {label}
      </label>
      {children}
    </div>
  );
}

function Choice<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T | null;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-fg-secondary">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={option.value === value}
            className={
              option.value === value
                ? 'touch-target rounded-pill bg-accent px-5 text-sm font-semibold text-accent-ink'
                : 'touch-target rounded-pill border border-border px-5 text-sm font-semibold text-fg-secondary'
            }
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
