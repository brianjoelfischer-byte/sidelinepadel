'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { completeOnboarding } from '@/actions/onboarding';
import { countryOptions } from '@/lib/countries';
import { levelBand, localCategory } from '@/lib/levels/scale';
import { useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

const TOTAL_STEPS = 5;

type Hand = 'left' | 'right';
type Side = 'drive' | 'reves' | 'indistinto';

interface Draft {
  displayName: string;
  birthDate: string;
  countryCode: string;
  declaredLevel: number;
  preferredHand: Hand;
  preferredSide: Side;
  racket: string;
}

type ErrorKey =
  | 'invalid_input'
  | 'under_minimum_age'
  | 'already_exists'
  | 'unavailable'
  | 'not_authenticated';

export function OnboardingFlow({
  locale,
  defaultCountry,
}: {
  locale: Locale;
  defaultCountry: string;
}) {
  const t = useTranslations('onboarding');
  const tLevel = useTranslations('level');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState(0);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [draft, setDraft] = useState<Draft>({
    displayName: '',
    birthDate: '',
    countryCode: defaultCountry,
    declaredLevel: 3.0,
    preferredHand: 'right',
    preferredSide: 'indistinto',
    racket: '',
  });

  const countries = countryOptions(locale);
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  /**
   * Cada paso decide si puede avanzar. Es validación de comodidad: la que
   * manda es la del servidor, y la verificación de edad vive allá (§8.3).
   */
  const canAdvance = [
    draft.displayName.trim().length >= 2,
    draft.birthDate !== '',
    draft.countryCode !== '',
    true,
    true,
  ];

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await completeOnboarding({
        ...draft,
        racket: draft.racket.trim() || undefined,
        locale,
        // La zona horaria la detecta el navegador. Es lo que decide a qué hora
        // ve el usuario sus turnos, así que se toma del dispositivo y no del
        // país: alguien de Argentina puede estar viviendo en Madrid.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        isPublic: true,
      });

      if (result.ok) {
        router.replace('/panel');
      } else {
        setError(result.error);
        // Un problema de edad o de nombre se corrige en su propio paso.
        if (result.error === 'under_minimum_age') setStep(1);
        else if (result.field === 'displayName') setStep(0);
      }
    });
  }

  const localLabel = localCategory(draft.declaredLevel, draft.countryCode);
  const bandLabel = tLevel(
    `scale.${levelBand(draft.declaredLevel)}` as 'scale.intermediate',
  );

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center gap-3">
        <div
          className="h-1 flex-1 overflow-hidden rounded-pill bg-bg-elevated"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
        >
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>
        <span className="text-xs text-fg-muted">
          {t('stepOf', { current: step + 1, total: TOTAL_STEPS })}
        </span>
      </div>

      <div className="mt-10">
        {step === 0 ? (
          <Step title={t('name.title')} subtitle={t('name.subtitle')}>
            <Field label={t('name.label')} htmlFor="displayName">
              <input
                id="displayName"
                value={draft.displayName}
                onChange={(e) => update('displayName', e.target.value)}
                placeholder={t('name.placeholder')}
                autoComplete="name"
                maxLength={40}
                className="touch-target w-full rounded-card border border-border bg-bg-surface px-4 py-3"
              />
            </Field>
          </Step>
        ) : null}

        {step === 1 ? (
          <Step title={t('birth.title')} subtitle={t('birth.subtitle')}>
            <Field label={t('birth.label')} htmlFor="birthDate">
              <input
                id="birthDate"
                type="date"
                value={draft.birthDate}
                onChange={(e) => update('birthDate', e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="touch-target w-full rounded-card border border-border bg-bg-surface px-4 py-3"
              />
            </Field>
          </Step>
        ) : null}

        {step === 2 ? (
          <Step title={t('country.title')} subtitle={t('country.subtitle')}>
            <Field label={t('country.label')} htmlFor="countryCode">
              <select
                id="countryCode"
                value={draft.countryCode}
                onChange={(e) => update('countryCode', e.target.value)}
                className="touch-target w-full rounded-card border border-border bg-bg-surface px-4 py-3"
              >
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </Step>
        ) : null}

        {step === 3 ? (
          <Step title={t('game.title')} subtitle={t('game.subtitle')}>
            <Choice
              label={t('game.handLabel')}
              value={draft.preferredHand}
              onChange={(v) => update('preferredHand', v)}
              options={[
                { value: 'right', label: t('game.right') },
                { value: 'left', label: t('game.left') },
              ]}
            />
            <Choice
              label={t('game.sideLabel')}
              value={draft.preferredSide}
              onChange={(v) => update('preferredSide', v)}
              options={[
                { value: 'drive', label: t('game.drive') },
                { value: 'reves', label: t('game.reves') },
                { value: 'indistinto', label: t('game.indistinto') },
              ]}
            />
            <Field label={t('game.racketLabel')} htmlFor="racket">
              <input
                id="racket"
                value={draft.racket}
                onChange={(e) => update('racket', e.target.value)}
                placeholder={t('game.racketPlaceholder')}
                maxLength={80}
                className="touch-target w-full rounded-card border border-border bg-bg-surface px-4 py-3"
              />
            </Field>
          </Step>
        ) : null}

        {step === 4 ? (
          <Step title={t('level.title')} subtitle={t('level.subtitle')}>
            <div className="rounded-card border border-border bg-bg-surface p-6 text-center">
              <p className="font-display text-5xl font-bold text-accent">
                {draft.declaredLevel.toFixed(1).replace('.', locale === 'es' ? ',' : '.')}
              </p>
              <p className="mt-2 text-sm uppercase tracking-widest text-fg-secondary">
                {bandLabel}
              </p>

              {/* La equivalencia ayuda a elegir: "4,2" no le dice nada a quien
                  toda su vida habló de cuartas y quintas. Va marcada como
                  aproximación — la categoría real sale de torneos. */}
              {localLabel ? (
                <p className="mt-3 text-sm text-accent-2">
                  ≈ {localLabel}{' '}
                  <span className="text-fg-muted">{tLevel('categoryHint')}</span>
                </p>
              ) : null}

              <input
                type="range"
                min={1}
                max={7}
                step={0.1}
                value={draft.declaredLevel}
                onChange={(e) => update('declaredLevel', Number(e.target.value))}
                aria-label={t('level.title')}
                className="mt-6 w-full accent-[var(--color-accent)]"
              />
            </div>

            {/* §12.1 · Se dice desde el principio que la comunidad va a opinar.
                Enterarse después de que tu nivel se movió sería una sorpresa. */}
            <p className="mt-4 text-xs leading-relaxed text-fg-muted">
              {t('level.communityNote')}
            </p>
          </Step>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-6 rounded-card border border-loss/40 bg-loss/10 px-4 py-3 text-sm"
        >
          {t(`errors.${error}` as 'errors.unavailable')}
        </p>
      ) : null}

      <div className="mt-10 flex gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={isPending}
            className="touch-target rounded-pill border border-border px-6 font-semibold disabled:opacity-60"
          >
            {t('back')}
          </button>
        ) : null}

        <button
          type="button"
          disabled={isPending || !canAdvance[step]}
          onClick={() =>
            step === TOTAL_STEPS - 1 ? submit() : setStep((s) => s + 1)
          }
          className="touch-target flex-1 rounded-pill bg-accent px-6 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {step === TOTAL_STEPS - 1
            ? isPending
              ? t('saving')
              : t('finish')
            : t('next')}
        </button>
      </div>
    </div>
  );
}

function Step({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-2xl">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-fg-secondary">{subtitle}</p>
      <div className="mt-8 space-y-6">{children}</div>
    </div>
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
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-fg-secondary">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={
                selected
                  ? 'touch-target rounded-pill bg-accent px-5 text-sm font-semibold text-accent-ink'
                  : 'touch-target rounded-pill border border-border px-5 text-sm font-semibold text-fg-secondary'
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
