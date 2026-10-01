'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId } from 'react';

import {
  LEVEL_MAX,
  LEVEL_MIN,
  LEVEL_STEP,
  formatLevel,
  levelBand,
  localCategory,
} from '@/lib/levels/scale';

/**
 * Barrita para darle nivel a alguien con quien jugaste.
 *
 * La misma escala que la del alta: el número del 1 al 7 y, al lado, la
 * categoría que le corresponde en tu país ("≈ 6ta"). Con una cajita de
 * número suelta nadie sabía si poner "6ta" o "3,5".
 *
 * Es opcional: sin tocar "Darle nivel" no se guarda nada. Una opinión a
 * ciegas ensucia el promedio más de lo que lo ayuda.
 */
export function LevelSlider({
  label,
  value,
  onChange,
  countryCode,
  startAt,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  /** País del que carga: define si se muestra "6ta" o "Media-Baja". */
  countryCode: string | null;
  /** Dónde arranca la barrita al activarla: tu propio nivel. */
  startAt: number;
}) {
  const t = useTranslations('session');
  const tLevel = useTranslations('level');
  const locale = useLocale();
  const id = useId();

  if (value === null) {
    return (
      <button
        type="button"
        onClick={() => onChange(Math.round(startAt * 10) / 10)}
        className="touch-target rounded-pill border border-border px-4 text-xs font-bold uppercase tracking-wider text-fg-secondary hover:text-fg"
      >
        + {label}
      </button>
    );
  }

  const category = countryCode ? localCategory(value, countryCode) : null;
  const band = tLevel(`scale.${levelBand(value)}` as 'scale.intermediate');

  return (
    <div className="w-full rounded-xl border border-white/10 bg-black/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="eyebrow text-fg-secondary">
          {label}
        </label>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="touch-target -my-2 px-2 text-xs font-semibold text-fg-muted hover:text-fg"
        >
          {t('levelClear')}
        </button>
      </div>

      {/* "≈ 6ta (3,7)": la categoría primero, que es como se habla en la
          cancha, y el número exacto al lado. */}
      <p className="mt-1 flex items-baseline gap-2" aria-hidden="true">
        {category ? (
          <span className="font-display text-3xl font-bold text-accent">≈ {category}</span>
        ) : (
          <span className="font-display text-2xl font-bold uppercase text-accent">{band}</span>
        )}
        <span className="font-display text-xl font-semibold text-fg">
          ({formatLevel(value, locale)})
        </span>
        {category ? <span className="text-xs uppercase text-fg-muted">{band}</span> : null}
      </p>

      <input
        id={id}
        type="range"
        min={LEVEL_MIN}
        max={LEVEL_MAX}
        step={LEVEL_STEP}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={
          category
            ? `${category}, ${formatLevel(value, locale)}`
            : `${band}, ${formatLevel(value, locale)}`
        }
        className="mt-2 w-full accent-[var(--color-accent)]"
      />
      <div aria-hidden="true" className="flex justify-between text-[11px] text-fg-muted">
        <span>{formatLevel(LEVEL_MIN, locale)}</span>
        <span>{formatLevel(LEVEL_MAX, locale)}</span>
      </div>
    </div>
  );
}
