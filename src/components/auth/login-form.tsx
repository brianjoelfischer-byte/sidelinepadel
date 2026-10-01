'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { sendMagicLink, startGoogleSignIn } from '@/actions/auth';
import type { Locale } from '@/i18n/routing';

type ErrorKey =
  | 'invalid_email'
  | 'rate_limited'
  | 'unavailable'
  | 'missing_code'
  | 'invalid_code';

const KNOWN_ERRORS: ErrorKey[] = [
  'invalid_email',
  'rate_limited',
  'unavailable',
  'missing_code',
  'invalid_code',
];

function asErrorKey(value: string | undefined): ErrorKey | null {
  return KNOWN_ERRORS.includes(value as ErrorKey) ? (value as ErrorKey) : null;
}

export function LoginForm({
  locale,
  initialError,
  googleEnabled,
}: {
  locale: Locale;
  initialError?: string | undefined;
  /** Si Google está activado en Supabase. Apagado, el botón no se muestra. */
  googleEnabled: boolean;
}) {
  const t = useTranslations('auth');
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(asErrorKey(initialError));

  function handleSubmit(formData: FormData) {
    const email = String(formData.get('email') ?? '');
    setError(null);

    startTransition(async () => {
      try {
        const result = await sendMagicLink({ email, locale });
        if (result.ok) setSent(true);
        else setError(result.error);
      } catch {
        // Sin respuesta del servidor (sin señal, servidor caído): la acción
        // tira en vez de devolver un error. Sin este catch la pantalla
        // quedaba muda.
        setError('unavailable');
      }
    });
  }

  function handleGoogle() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await startGoogleSignIn({ locale });
        if (result.ok) window.location.href = result.url;
        else setError('unavailable');
      } catch {
        setError('unavailable');
      }
    });
  }

  /**
   * Pantalla de "revisá tu correo". El texto dice "si esa dirección tiene
   * cuenta" a propósito: confirmar que existe permitiría averiguar qué emails
   * están registrados probando direcciones.
   */
  if (sent) {
    return (
      <div className="mt-10 card-glass p-6 text-center">
        <p className="text-lg font-semibold">{t('checkInbox')}</p>
        <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
          {t('checkInboxBody')}
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="touch-target mt-6 text-sm font-semibold text-accent underline-offset-4 hover:underline"
        >
          {t('backToEmail')}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <form action={handleSubmit} className="space-y-3">
        <label htmlFor="email" className="block text-sm font-bold uppercase tracking-wider text-fg-secondary">
          {t('emailLabel')}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder={t('emailPlaceholder')}
          aria-invalid={error === 'invalid_email' ? 'true' : undefined}
          aria-describedby={error ? 'login-error' : undefined}
          className="touch-target w-full rounded-card border border-border bg-bg-surface px-4 py-3 text-fg placeholder:text-fg-muted"
        />

        <button
          type="submit"
          disabled={isPending}
          className="btn-gold touch-target w-full px-6 py-3 disabled:opacity-60"
        >
          {isPending ? t('sending') : t('sendLink')}
        </button>
      </form>

      {error ? (
        <p
          id="login-error"
          role="alert"
          className="mt-4 rounded-card border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-fg"
        >
          {t(`errors.${error}` as 'errors.unavailable')}
        </p>
      ) : null}

      {googleEnabled ? (
        <>
          <div className="my-6 flex items-center gap-4" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-widest text-fg-muted">
              {t('or')}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={isPending}
            className="btn-dark touch-target w-full px-6 py-3 disabled:opacity-60"
          >
            {t('google')}
          </button>
        </>
      ) : null}
    </div>
  );
}
