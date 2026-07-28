import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Logo } from '@/components/logo';

export default function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations('landing');
  const tMeta = useTranslations('meta');
  const tDisclaimer = useTranslations('disclaimer');

  const features = [
    { key: 'track', icon: '📈' },
    { key: 'level', icon: '🎯' },
    { key: 'match', icon: '🤝' },
  ] as const;

  return (
    <main className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Logo />
        <LocaleSwitcher />
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-16 pt-10 sm:pt-20">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          {tMeta('tagline')}
        </p>

        <h1 className="mt-4 max-w-2xl text-4xl leading-[1.1] sm:text-6xl">
          {t('heroTitle')}
        </h1>

        <p className="mt-6 max-w-xl text-lg text-fg-secondary">
          {t('heroSubtitle')}
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <button
            type="button"
            className="touch-target rounded-pill bg-accent px-8 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
          >
            {t('cta')}
          </button>
          <button
            type="button"
            className="touch-target rounded-pill border border-border px-8 py-3 font-semibold text-fg transition-colors hover:bg-bg-surface"
          >
            {t('ctaSecondary')}
          </button>
        </div>

        {/* §12.7 · El aviso vive en la landing desde el primer día.
            No es un detalle legal: es la expectativa del producto. */}
        <p className="mt-8 max-w-xl rounded-card border border-accent-2/40 bg-accent-2/5 px-4 py-3 text-sm text-fg-secondary">
          {tDisclaimer('noBooking')}
        </p>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-3">
        {features.map(({ key, icon }) => (
          <article
            key={key}
            className="rounded-card border border-border bg-bg-surface p-6"
          >
            <span aria-hidden="true" className="text-2xl">
              {icon}
            </span>
            <h2 className="mt-3 text-lg">
              {t(`features.${key}Title` as 'features.trackTitle')}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
              {t(`features.${key}Body` as 'features.trackBody')}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
