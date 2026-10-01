import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';

import { DisplayTitle } from '@/components/display-title';
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

  const features = [
    { key: 'track', Icon: MatchesIcon },
    { key: 'level', Icon: TrendIcon },
    { key: 'match', Icon: UsersIcon },
  ] as const;

  return (
    // `clip` y no `hidden`: recorta el brillo de la vista previa sin romper
    // la cabecera fija.
    <div className="min-h-dvh overflow-x-clip">
      <header className="sticky top-0 z-30 bg-gradient-to-b from-[#1a1a1a] to-black shadow-[0_1px_0_0_var(--color-accent)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Logo />
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <Link
            href="/entrar"
            className="btn-dark touch-target px-5 text-sm"
          >
            {t('signIn')}
          </Link>
        </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-8 sm:pt-16 lg:grid-cols-[1fr_26rem]">
          <div>
            <p className="eyebrow text-accent">{tMeta('tagline')}</p>

            <DisplayTitle
              text={t('heroTitle')}
              className="mt-4 max-w-2xl text-6xl sm:text-8xl"
            />

            <p className="mt-6 max-w-xl text-xl text-fg-secondary">{t('heroSubtitle')}</p>

            {/* Enlaces, no botones: navegan. Funcionan sin JavaScript, se abren en
                otra pestaña y el lector de pantalla los anuncia como lo que son. */}
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/entrar"
                className="btn-gold touch-target px-8 py-3"
              >
                {t('cta')}
              </Link>
              <a
                href="#como-funciona"
                className="btn-dark touch-target px-8 py-3 text-[1.1875rem]"
              >
                {t('ctaSecondary')}
              </a>
            </div>

            {/* El aviso de que la app no reserva canchas NO va acá: va donde
                se arma un turno (§12.8), que es donde está el riesgo de
                creer que se reservó. Ver components/offers. */}
          </div>

          {/* Vista previa: cómo se ve adentro, con los componentes reales de la
              app y datos de ejemplo. Oculta al lector de pantalla, que en su
              lugar oye la descripción: leer un partido inventado no sirve. */}
          <figure className="relative">
            <figcaption className="sr-only">{t('previewLabel')}</figcaption>
            <div
              aria-hidden="true"
              className="rounded-[1.75rem] border border-white/15 bg-gradient-to-b from-[#1a1a1a] to-black p-5 shadow-2xl shadow-black/50"
            >
              <p className="eyebrow text-accent">{t('previewDate')}</p>
              <p className="mt-1 font-display text-3xl font-bold uppercase">{t('previewGreeting')}</p>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <PreviewStat label={t('previewMatches')} value="24" />
                <PreviewStat label={t('previewWins')} value="63 %" accent />
                <PreviewStat label={t('previewStreak')} value="3" win />
              </div>

              <div className="mt-4">
                <FormStrip form={['win', 'win', 'win', 'loss', 'win']} />
              </div>

              <div className="card-glass mt-5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold">{t('previewVenue')}</p>
                  <span className="shrink-0 whitespace-nowrap rounded-md bg-win px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-black">
                    ▲ {t('previewWin')}
                  </span>
                </div>
                <div className="mt-3 rounded-xl border border-white/10 bg-black/60 px-3 py-2">
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
              className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-accent/15 blur-3xl"
            />
          </figure>
        </section>

        {/* Hoja blanca sobre el negro, con las esquinas de arriba redondeadas:
            el corte de sección de las portadas del circuito. */}
        <section
          id="como-funciona"
          aria-labelledby="como-funciona-titulo"
          className="scroll-mt-20 rounded-t-[2rem] bg-white text-black"
        >
          <div className="mx-auto max-w-6xl px-6 pb-24 pt-14">
            <h2
              id="como-funciona-titulo"
              className="text-5xl leading-[0.95] sm:text-6xl"
            >
              {t('howTitle')}
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {features.map(({ key, Icon }) => (
                <article key={key} className="rounded-card border border-black/10 bg-[#f4f4f4] p-6">
                  <span className="bg-gold-card grid h-12 w-12 place-items-center rounded-xl border border-black text-white shadow-[2.5px_2.5px_0_#000]">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-5 text-2xl">
                    {t(`features.${key}Title` as 'features.trackTitle')}
                  </h3>
                  <p className="mt-2 leading-relaxed text-[#3a3a3a]">
                    {t(`features.${key}Body` as 'features.trackBody')}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-black shadow-[0_-1px_0_0_var(--color-accent)]">
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
