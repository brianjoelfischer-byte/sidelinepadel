import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Logo } from '@/components/logo';
import { MatchesIcon, TrendIcon, UsersIcon } from '@/components/nav/icons';
import { FormStrip } from '@/components/sessions/result-badge';
import { Scoreboard } from '@/components/sessions/scoreboard';
import { Link } from '@/i18n/navigation';

/**
 * Portada. Estática (se arma una vez en el build): no consulta quién sos.
 * "Entrar" y "Empezar" llevan a /entrar, que si ya tenés sesión te manda
 * directo al panel — así la portada no necesita saberlo.
 */
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
    { key: 'track', Icon: MatchesIcon },
    { key: 'level', Icon: TrendIcon },
    { key: 'match', Icon: UsersIcon },
  ] as const;

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6">
        <Logo />
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <Link
            href="/entrar"
            className="touch-target inline-flex items-center rounded-pill border border-border px-5 text-sm font-semibold transition-colors hover:bg-bg-surface"
          >
            {t('signIn')}
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-8 sm:pt-16 lg:grid-cols-[1fr_26rem]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              {tMeta('tagline')}
            </p>

            <h1 className="mt-4 max-w-2xl text-4xl leading-[1.05] sm:text-6xl">
              {t('heroTitle')}
            </h1>

            <p className="mt-6 max-w-xl text-lg text-fg-secondary">{t('heroSubtitle')}</p>

            {/* Enlaces, no botones: navegan. Funcionan sin JavaScript, se abren en
                otra pestaña y el lector de pantalla los anuncia como lo que son. */}
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/entrar"
                className="touch-target inline-flex items-center rounded-pill bg-accent px-8 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
              >
                {t('cta')}
              </Link>
              <a
                href="#como-funciona"
                className="touch-target inline-flex items-center rounded-pill border border-border px-8 py-3 font-semibold text-fg transition-colors hover:bg-bg-surface"
              >
                {t('ctaSecondary')}
              </a>
            </div>

            {/* §12.7 · El aviso vive en la landing desde el primer día.
                No es un detalle legal: es la expectativa del producto. */}
            <p className="mt-8 max-w-xl rounded-card border border-accent-2/40 bg-accent-2/5 px-4 py-3 text-sm text-fg-secondary">
              {tDisclaimer('noBooking')}
            </p>
          </div>

          {/* Vista previa: cómo se ve adentro, con los componentes reales de la
              app y datos de ejemplo. Oculta al lector de pantalla, que en su
              lugar oye la descripción: leer un partido inventado no sirve. */}
          <figure className="relative">
            <figcaption className="sr-only">{t('previewLabel')}</figcaption>
            <div
              aria-hidden="true"
              className="rounded-[1.75rem] border border-border bg-bg-surface p-5 shadow-2xl shadow-black/50"
            >
              <p className="text-xs text-fg-muted first-letter:uppercase">{t('previewDate')}</p>
              <p className="mt-1 font-display text-2xl font-bold">{t('previewGreeting')}</p>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <PreviewStat label={t('previewMatches')} value="24" />
                <PreviewStat label={t('previewWins')} value="63 %" accent />
                <PreviewStat label={t('previewStreak')} value="3" win />
              </div>

              <div className="mt-4">
                <FormStrip form={['win', 'win', 'win', 'loss', 'win']} />
              </div>

              <div className="mt-5 rounded-card border border-border bg-bg-base p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-fg-secondary">{t('previewVenue')}</p>
                  <span className="shrink-0 whitespace-nowrap rounded-pill bg-win/15 px-2.5 py-0.5 text-[11px] font-semibold text-win">
                    ▲ {t('previewWin')}
                  </span>
                </div>
                <div className="mt-3">
                  <Scoreboard
                    sets={[
                      { me: 3, opp: 6 },
                      { me: 6, opp: 3 },
                      { me: 7, opp: 5 },
                    ]}
                  />
                </div>
              </div>
            </div>
            {/* Brillo de fondo: decorativo, detrás de la tarjeta. */}
            <div
              aria-hidden="true"
              className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-accent/10 blur-3xl"
            />
          </figure>
        </section>

        <section
          id="como-funciona"
          className="mx-auto grid max-w-6xl scroll-mt-6 gap-4 px-6 pb-24 sm:grid-cols-3"
        >
          {features.map(({ key, Icon }) => (
            <article key={key} className="rounded-card border border-border bg-bg-surface p-6">
              <span className="grid h-11 w-11 place-items-center rounded-card bg-accent/10 text-accent">
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-lg">
                {t(`features.${key}Title` as 'features.trackTitle')}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
                {t(`features.${key}Body` as 'features.trackBody')}
              </p>
            </article>
          ))}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-fg-muted">
          <Logo />
          <p>
            {t('footerOsm')}{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-fg"
            >
              OpenStreetMap
            </a>{' '}
            (ODbL)
          </p>
        </div>
      </footer>
    </div>
  );
}

function PreviewStat({
  label,
  value,
  accent = false,
  win = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  win?: boolean;
}) {
  return (
    <div className="rounded-card border border-border bg-bg-base px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-fg-muted">{label}</p>
      <p
        className={`mt-1 font-display text-xl font-bold tabular-nums ${
          accent ? 'text-accent' : win ? 'text-win' : 'text-fg'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
