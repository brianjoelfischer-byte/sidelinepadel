'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';

import { searchVenues, type VenueOption } from '@/actions/venues';

/**
 * Campo "Dónde jugaste" con sugerencias de clubes · §13.
 *
 * Dos resultados posibles, y los dos valen:
 *  · elegís un club de la lista → se guarda su id, y el historial después
 *    muestra nombre y ciudad reales y abre el lugar exacto en Google Maps.
 *  · no está, o no elegís → se guarda el texto tal cual (`venue_freetext`).
 *    Nunca se bloquea a nadie por un club que falta en OpenStreetMap.
 *
 * Accesible según el patrón combobox de ARIA: el foco queda siempre en el
 * campo, las flechas mueven la opción activa, Enter elige, Escape cierra.
 */

export interface VenueValue {
  id: string | null;
  name: string;
  city: string | null;
}

export const emptyVenue: VenueValue = { id: null, name: '', city: null };

const DEBOUNCE_MS = 250;

export function VenuePicker({
  value,
  onChange,
  preferCountry,
  label,
  search = searchVenues,
}: {
  value: VenueValue;
  onChange: (value: VenueValue) => void;
  preferCountry: string | null;
  label: string;
  /**
   * Quién busca. En la app, siempre `searchVenues`. Se puede reemplazar para
   * probar el componente contra una base local sin Supabase de por medio.
   */
  search?: typeof searchVenues;
}) {
  const t = useTranslations('session');
  const inputId = useId();
  const listId = useId();

  // La última respuesta, junto con lo que se buscó. Las opciones visibles se
  // DERIVAN de acá: si lo escrito ya no coincide, no se muestran. Así no hace
  // falta limpiar la lista a mano en cada tecla.
  const [results, setResults] = useState<{ query: string; options: VenueOption[] }>({
    query: '',
    options: [],
  });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  // Cada búsqueda lleva un número: si vuelve una vieja después de una nueva
  // (la red no garantiza el orden), se descarta.
  const requestId = useRef(0);

  const query = value.id ? '' : value.name.trim();

  useEffect(() => {
    if (query.length < 2) return;

    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      const found = await search({
        q: query,
        ...(preferCountry ? { country: preferCountry } : {}),
      });
      if (id !== requestId.current) return;
      setResults({ query, options: found });
      setActive(found.length > 0 ? 0 : -1);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, preferCountry, search]);

  const answered = query.length >= 2 && results.query === query;
  const options = answered ? results.options : [];

  function choose(option: VenueOption) {
    onChange({ id: option.id, name: option.name, city: option.city });
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || options.length === 0) {
      if (event.key === 'ArrowDown' && options.length > 0) setOpen(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (event.key === 'Enter') {
      const option = options[active];
      if (option) {
        event.preventDefault();
        choose(option);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  const showList = open && options.length > 0;
  const showNoResults = open && answered && options.length === 0;
  const activeOption = showList ? options[active] : undefined;

  return (
    <div className="relative">
      <label htmlFor={inputId} className="mb-2 block text-sm font-semibold text-fg-secondary">
        {label}
      </label>

      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        {...(activeOption ? { 'aria-activedescendant': `${listId}-${activeOption.id}` } : {})}
        autoComplete="off"
        value={value.name}
        maxLength={120}
        placeholder={t('venuePlaceholder')}
        onChange={(e) => {
          // Escribir encima de un club elegido lo "suelta": vuelve a ser texto.
          onChange({ id: null, name: e.target.value, city: null });
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // El clic en una opción llega después del blur: sin esta pausa, la
        // lista se cerraría antes de registrar la elección.
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        className="touch-target w-full rounded-card border border-border bg-bg-surface px-4 py-3"
      />

      {value.id ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-win">
          <span aria-hidden="true">✓</span>
          {value.city ? t('venueChosenIn', { city: value.city }) : t('venueChosen')}
        </p>
      ) : null}

      <ul
        id={listId}
        role="listbox"
        aria-label={label}
        hidden={!showList}
        className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-auto rounded-card border border-border bg-bg-elevated py-1 shadow-lg"
      >
        {options.map((option, index) => (
          <li
            key={option.id}
            id={`${listId}-${option.id}`}
            role="option"
            aria-selected={index === active}
            // mousedown y no click: se dispara antes del blur del campo.
            onMouseDown={(e) => {
              e.preventDefault();
              choose(option);
            }}
            onMouseEnter={() => setActive(index)}
            className={
              index === active
                ? 'cursor-pointer bg-bg-surface px-4 py-2.5'
                : 'cursor-pointer px-4 py-2.5'
            }
          >
            <span className="block font-semibold text-fg">{option.name}</span>
            <span className="block text-xs text-fg-muted">
              {[
                option.city,
                option.courts ? t('venueCourts', { count: option.courts }) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </li>
        ))}
        <li
          role="presentation"
          className="border-t border-border px-4 pb-1 pt-2 text-[11px] text-fg-muted"
        >
          {t('venueAttribution')}
        </li>
      </ul>

      {showNoResults ? (
        <p className="mt-2 text-xs text-fg-muted">{t('venueNoResults')}</p>
      ) : null}

      {/* Para el lector de pantalla: cuántos clubes aparecieron. */}
      <p aria-live="polite" className="sr-only">
        {answered ? t('venueResults', { count: options.length }) : ''}
      </p>
    </div>
  );
}
