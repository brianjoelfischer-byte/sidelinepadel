'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useState, useTransition } from 'react';

import {
  findSimilarVenues,
  knownCities,
  submitVenue,
  type SimilarVenue,
} from '@/actions/venues';
import { regionsFor } from '@/lib/venues/regions';

/**
 * Agregar un club que no está en la lista · §13.
 *
 * El objetivo es que cada club exista una sola vez, aunque lo agreguen cientos
 * de jugadores con nombres escritos distinto. Por eso, antes de crear:
 *
 *  1. Provincia de una lista (no a mano) y ciudad con sugerencias de las ya
 *     cargadas, así "Córdoba" no termina siendo también "Cordoba" y "Cba".
 *  2. La base busca parecidos en esa ciudad y provincia, y si hay, pregunta
 *     "¿es alguno de estos?".
 *  3. Aunque se diga que no, si el nombre es el mismo sin tildes ni palabras
 *     como "Club" o "Pádel", la base devuelve el existente y no duplica.
 *
 * La ubicación exacta es opcional: con "Estoy en el club" se toma la del
 * celular. Sin ella el club igual se busca y se deduplica por ciudad.
 */

export interface AddedVenue {
  id: string;
  name: string;
  city: string;
  /** Ya existía: la base devolvió ese en vez de duplicarlo. */
  existed: boolean;
}

type Actions = {
  findSimilar: typeof findSimilarVenues;
  submit: typeof submitVenue;
  cities: typeof knownCities;
};

const defaultActions: Actions = {
  findSimilar: findSimilarVenues,
  submit: submitVenue,
  cities: knownCities,
};

export function AddVenuePanel({
  initialName,
  country,
  onDone,
  onCancel,
  actions = defaultActions,
}: {
  initialName: string;
  country: string;
  onDone: (venue: AddedVenue) => void;
  onCancel: () => void;
  /** Se reemplaza solo para probar la pantalla sin Supabase. */
  actions?: Actions;
}) {
  const t = useTranslations('addVenue');
  const tCommon = useTranslations('common');
  const ids = { name: useId(), region: useId(), city: useId(), cities: useId(), address: useId() };

  const regions = regionsFor(country);
  const [name, setName] = useState(initialName.trim());
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [geo, setGeo] = useState<'idle' | 'locating' | 'failed'>('idle');
  const [cities, setCities] = useState<string[]>([]);
  const [similar, setSimilar] = useState<SimilarVenue[] | null>(null);
  const [error, setError] = useState<'missing' | 'unavailable' | null>(null);
  const [isPending, startTransition] = useTransition();

  // Ciudades ya cargadas en la provincia elegida, para sugerir mientras se
  // escribe. Si falla, no hay sugerencias y listo.
  useEffect(() => {
    let alive = true;
    actions
      .cities({ country, ...(region ? { adminArea: region } : {}) })
      .catch(() => [])
      .then((list) => {
        if (alive) setCities(list);
      });
    return () => {
      alive = false;
    };
  }, [actions, country, region]);

  const draft = {
    name: name.trim(),
    country,
    city: city.trim(),
    ...(region ? { adminArea: region } : {}),
    ...(address.trim() ? { address: address.trim() } : {}),
    ...(point ? { lat: point.lat, lng: point.lng } : {}),
  };

  const valid = draft.name.length >= 2 && draft.city.length >= 2 && (!regions || region !== '');

  function locate() {
    if (!('geolocation' in navigator)) {
      setGeo('failed');
      return;
    }
    setGeo('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeo('idle');
      },
      () => setGeo('failed'),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  function create() {
    startTransition(async () => {
      try {
        const result = await actions.submit(draft);
        if (result.ok) {
          onDone({ id: result.id, name: draft.name, city: draft.city, existed: !result.created });
          return;
        }
      } catch {
        // Sin respuesta del servidor: mismo aviso que un error.
      }
      setError('unavailable');
    });
  }

  function next() {
    setError(null);
    if (!valid) {
      setError('missing');
      return;
    }
    startTransition(async () => {
      let found: SimilarVenue[] = [];
      try {
        found = await actions.findSimilar(draft);
      } catch {
        // Si no se pudo buscar parecidos, se sigue: la base igual evita el
        // duplicado exacto al crear.
      }
      if (found.length > 0) setSimilar(found);
      else create();
    });
  }

  // ── Paso 2: ¿es alguno de estos? ───────────────────────────────────────
  if (similar) {
    return (
      <section
        aria-labelledby={`${ids.name}-similar`}
        className="mt-3 rounded-card border border-accent-2/40 bg-bg-surface p-4"
      >
        <h3 id={`${ids.name}-similar`} className="font-semibold">
          {t('similarTitle')}
        </h3>
        <p className="mt-1 text-sm text-fg-secondary">{t('similarBody')}</p>

        <ul className="mt-3 space-y-2">
          {similar.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between gap-3 rounded-card border border-border bg-bg-elevated p-3"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">{v.name}</span>
                <span className="block text-xs text-fg-muted">
                  {[v.city, v.adminArea].filter(Boolean).join(', ')}
                  {' · '}
                  {v.verified ? t('verified') : t('byPlayers', { count: v.players })}
                </span>
              </span>
              <button
                type="button"
                onClick={() =>
                  onDone({ id: v.id, name: v.name, city: v.city ?? draft.city, existed: true })
                }
                className="btn-gold touch-target shrink-0 px-4"
              >
                {t('isThis')}
              </button>
            </li>
          ))}
        </ul>

        {error === 'unavailable' ? (
          <p role="alert" className="mt-3 text-sm text-loss">
            {t('errorUnavailable')}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setSimilar(null)}
            disabled={isPending}
            className="touch-target rounded-pill px-4 text-sm font-semibold text-fg-secondary hover:text-fg"
          >
            {tCommon('back')}
          </button>
          <button
            type="button"
            onClick={create}
            disabled={isPending}
            className="touch-target rounded-pill border border-border px-4 text-sm font-semibold disabled:opacity-60"
          >
            {isPending ? t('adding') : t('notTheseAdd')}
          </button>
        </div>
      </section>
    );
  }

  // ── Paso 1: los datos ──────────────────────────────────────────────────
  return (
    <section
      aria-labelledby={`${ids.name}-title`}
      className="mt-3 card-glass p-4"
      // El panel vive dentro del formulario del partido: Enter en un campo lo
      // mandaría entero. Acá Enter no hace nada; se sigue con el botón.
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.preventDefault();
      }}
    >
      <h3 id={`${ids.name}-title`} className="font-semibold">
        {t('title')}
      </h3>
      <p className="mt-1 text-xs text-fg-muted">{t('subtitle')}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2" htmlFor={ids.name}>
          <span className="mb-1 block text-sm font-bold uppercase tracking-wider text-fg-secondary">{t('name')}</span>
          <input
            id={ids.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            autoComplete="off"
            className="touch-target w-full rounded-card border border-border bg-bg-elevated px-4 py-2.5"
          />
        </label>

        <label className="block" htmlFor={ids.region}>
          <span className="mb-1 block text-sm font-bold uppercase tracking-wider text-fg-secondary">{t('region')}</span>
          {regions ? (
            <select
              id={ids.region}
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                setCity('');
              }}
              className="touch-target w-full rounded-card border border-border bg-bg-elevated px-3 py-2.5"
            >
              <option value="">{t('regionPick')}</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={ids.region}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              maxLength={80}
              className="touch-target w-full rounded-card border border-border bg-bg-elevated px-4 py-2.5"
            />
          )}
        </label>

        <label className="block" htmlFor={ids.city}>
          <span className="mb-1 block text-sm font-bold uppercase tracking-wider text-fg-secondary">{t('city')}</span>
          <input
            id={ids.city}
            list={ids.cities}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            maxLength={80}
            autoComplete="off"
            className="touch-target w-full rounded-card border border-border bg-bg-elevated px-4 py-2.5"
          />
          {/* Las ciudades que ya tienen clubes: elegir una evita que la
              misma ciudad quede escrita de tres formas. */}
          <datalist id={ids.cities}>
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <label className="block sm:col-span-2" htmlFor={ids.address}>
          <span className="mb-1 block text-sm font-bold uppercase tracking-wider text-fg-secondary">
            {t('address')} <span className="font-normal text-fg-muted">({t('optional')})</span>
          </span>
          <input
            id={ids.address}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={160}
            className="touch-target w-full rounded-card border border-border bg-bg-elevated px-4 py-2.5"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {point ? (
          <>
            <span className="text-sm text-win">✓ {t('located')}</span>
            <button
              type="button"
              onClick={() => setPoint(null)}
              className="touch-target rounded-pill px-3 text-xs font-semibold text-fg-muted hover:text-fg"
            >
              {t('removeLocation')}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={locate}
            disabled={geo === 'locating'}
            className="touch-target rounded-pill border border-border px-4 text-sm font-semibold disabled:opacity-60"
          >
            📍 {geo === 'locating' ? t('locating') : t('imHere')}
          </button>
        )}
        {geo === 'failed' ? (
          <span className="text-xs text-fg-muted">{t('locationFailed')}</span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-loss">
          {error === 'missing'
            ? regions
              ? t('errorMissing')
              : t('errorMissingNoRegion')
            : t('errorUnavailable')}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="touch-target rounded-pill px-4 text-sm font-semibold text-fg-secondary hover:text-fg"
        >
          {tCommon('cancel')}
        </button>
        <button
          type="button"
          onClick={next}
          disabled={isPending}
          className="btn-gold touch-target px-5 disabled:opacity-60"
        >
          {isPending ? t('checking') : t('continue')}
        </button>
      </div>
    </section>
  );
}
