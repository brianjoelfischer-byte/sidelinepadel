'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { createSession } from '@/actions/sessions';
import { LevelSlider } from '@/components/sessions/level-slider';
import { VenuePicker, emptyVenue, type VenueValue } from '@/components/sessions/venue-picker';
import { resultFromSets, setWinner, type SetScore } from '@/lib/sessions/score';
import { useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

type Kind = 'match' | 'quick_match' | 'training';

/**
 * Un set mientras se carga. `null` es un casillero vacío: hace falta poder
 * borrar el número para escribir otro, y un 0 que vuelve solo no deja.
 */
interface SetDraft {
  me: number | null;
  opp: number | null;
}

function isComplete(set: SetDraft): set is SetScore {
  return set.me !== null && set.opp !== null;
}
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

export function SessionForm({
  locale: _locale,
  preferCountry,
  myLevel,
}: {
  locale: Locale;
  /** País del jugador: sus clubes aparecen primero en el buscador. */
  preferCountry: string | null;
  /** Tu nivel: de ahí arranca la barrita cuando le das nivel a alguien. */
  myLevel: number;
}) {
  const t = useTranslations('session');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [kind, setKind] = useState<Kind>('match');
  const [playedOn, setPlayedOn] = useState(today());
  const [venue, setVenue] = useState<VenueValue>(emptyVenue);
  const [sets, setSets] = useState<SetDraft[]>([{ me: 6, opp: 3 }]);
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
  const complete = sets.every(isComplete) ? sets.filter(isComplete) : null;
  const derived = kind === 'match' && complete ? resultFromSets(complete) : null;

  function updateSet(index: number, field: keyof SetDraft, value: number | null) {
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
      // Un club de la lista va por id; si no, el texto tal como se escribió.
      ...(venue.id
        ? { venueId: venue.id }
        : venue.name.trim()
          ? { venueFreetext: venue.name.trim() }
          : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(side ? { sidePlayed: side } : {}),
      ...(kind !== 'training' ? { selfRating } : {}),
    };

    if (kind === 'match' && !complete) {
      setError('invalid_score');
      return;
    }

    const payload =
      kind === 'match'
        ? { ...common, kind: 'match' as const, sets: complete ?? [] }
        : kind === 'quick_match'
          ? { ...common, kind: 'quick_match' as const, result: quickResult }
          : { ...common, kind: 'training' as const };

    startTransition(async () => {
      let result: Awaited<ReturnType<typeof createSession>>;
      try {
        result = await createSession(payload);
      } catch {
        // Sin respuesta del servidor (sin señal, servidor caído): la acción
        // tira en vez de devolver un error. Sin este catch la pantalla
        // quedaba muda.
        setError('unavailable');
        return;
      }
      if (result.ok) {
        router.push('/panel?aviso=guardado');
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

        <VenuePicker
          value={venue}
          onChange={setVenue}
          preferCountry={preferCountry}
          label={t('venue')}
        />
      </div>

      {/* Marcador */}
      {kind === 'match' ? (
        <section className="card-glass p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-fg-secondary">
              {t('score')}
            </h2>
            {derived ? (
              <span
                className={
                  derived === 'win'
                    ? 'rounded-md bg-win px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-black'
                    : derived === 'loss'
                      ? 'rounded-md bg-loss-strong px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white'
                      : 'rounded-pill bg-bg-elevated px-3 py-1 text-sm font-semibold text-fg-secondary'
                }
              >
                {t(`result.${derived}` as 'result.win')}
              </span>
            ) : null}
          </div>

          {/* Encabezado visible de las columnas. Antes "Vos" y "Rivales" solo
              estaban en el aria-label: a la vista, "6 – 3" no decía de quién
              era cada número. Oculto para el lector, que ya los oye en cada
              campo. */}
          <div aria-hidden="true" className="mt-4 flex items-center gap-3">
            <span className="w-14 shrink-0" />
            <span className="w-16 shrink-0 text-center text-xs font-semibold uppercase tracking-wider text-fg-secondary">
              {t('you')}
            </span>
            <span className="invisible shrink-0">–</span>
            <span className="w-16 shrink-0 text-center text-xs font-semibold uppercase tracking-wider text-fg-secondary">
              {t('them')}
            </span>
          </div>

          <div className="mt-2 space-y-3">
            {sets.map((set, index) => {
              const winner = isComplete(set) ? setWinner(set) : null;
              return (
                <div key={index} className="flex items-center gap-3">
                  <span className="w-14 shrink-0 text-xs uppercase tracking-wider text-fg-muted">
                    {t('setNumber', { n: index + 1 })}
                  </span>
                  <GameInput
                    label={`${t('you')} · ${t('setNumber', { n: index + 1 })}`}
                    value={set.me}
                    onChange={(v) => updateSet(index, 'me', v)}
                  />
                  <span className="shrink-0 text-fg-muted">–</span>
                  <GameInput
                    label={`${t('them')} · ${t('setNumber', { n: index + 1 })}`}
                    value={set.opp}
                    onChange={(v) => updateSet(index, 'opp', v)}
                  />
                  {/* Quién se llevó este set, en vivo. Un número mal tipeado
                      se ve acá, set por set, antes que en el resultado final. */}
                  {/* En celular no entra la palabra al lado de los dos números:
                      va un símbolo, y la palabra desde `sm`. Los símbolos
                      tienen forma distinta, así que no dependen del color, y
                      el lector de pantalla siempre oye la palabra. */}
                  <span
                    className={
                      winner === 'me'
                        ? 'shrink-0 text-sm font-semibold text-win'
                        : winner === 'opp'
                          ? 'shrink-0 text-sm font-semibold text-loss'
                          : 'shrink-0 text-sm text-fg-muted'
                    }
                  >
                    <span aria-hidden="true" className="sm:hidden">
                      {winner === 'me' ? '✓' : winner === 'opp' ? '✗' : '…'}
                    </span>
                    <span className="sr-only sm:not-sr-only sm:text-xs">
                      {winner === 'me'
                        ? t('setState.won')
                        : winner === 'opp'
                          ? t('setState.lost')
                          : t('setState.incomplete')}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {sets.length < 5 ? (
              <button
                type="button"
                onClick={() => setSets((s) => [...s, { me: 6, opp: 4 }])}
                className="touch-target whitespace-nowrap rounded-pill border border-border px-4 text-sm font-semibold"
              >
                {t('addSet')}
              </button>
            ) : null}
            {sets.length > 1 ? (
              <button
                type="button"
                onClick={() => setSets((s) => s.slice(0, -1))}
                className="touch-target whitespace-nowrap rounded-pill border border-border px-4 text-sm font-semibold text-fg-secondary"
              >
                {t('removeSet')}
              </button>
            ) : null}
          </div>

          {/* Mientras un set está a medio cargar, el aviso va acá abajo y no al
              lado del título: ahí no entraba en un celular y se partía. */}
          {derived ? (
            <p className="mt-3 text-xs text-fg-muted">{t('result.auto')}</p>
          ) : (
            <p className="mt-3 text-xs text-accent-2">{t('errors.invalid_score')}</p>
          )}
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
              className="card-glass p-4"
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
                  aria-label={t('removePlayer')}
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

              </div>

              {/* Nivel: para el compañero también. Antes solo se podía
                  valorar a los rivales. */}
              <div className="mt-3">
                <LevelSlider
                  label={player.team === 'mine' ? t('levelPartner') : t('levelOpponent')}
                  value={player.perceivedLevel}
                  onChange={(level) =>
                    setPlayers((current) =>
                      current.map((p, i) => (i === index ? { ...p, perceivedLevel: level } : p)),
                    )
                  }
                  countryCode={preferCountry}
                  startAt={myLevel}
                />
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
        className="btn-gold touch-target w-full px-6 py-3 disabled:opacity-50"
      >
        {isPending ? t('saving') : t('save')}
      </button>
    </div>
  );
}

/**
 * Casillero de juegos de un set. Texto numérico y no `type="number"`: así se
 * puede borrar y queda vacío (antes el 0 volvía solo), y escribir encima de
 * un número lo reemplaza en vez de sumarle un dígito.
 */
function GameInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      value={value ?? ''}
      aria-label={label}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        if (e.target.value === '') return onChange(null);
        // El último dígito tipeado: sobre un "6", escribir "4" deja 4. Una
        // letra no borra lo que había.
        const digit = e.target.value.replace(/\D/g, '').slice(-1);
        if (digit !== '') onChange(Number(digit));
      }}
      className="touch-target w-16 shrink-0 rounded-card border border-border bg-bg-elevated px-3 py-2 text-center text-lg font-semibold"
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
      <label htmlFor={htmlFor} className="block text-sm font-bold uppercase tracking-wider text-fg-secondary">
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
      <legend className="text-sm font-bold uppercase tracking-wider text-fg-secondary">{label}</legend>
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
