import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { use } from 'react';

import { DisplayTitle } from '@/components/display-title';
import { CalendarIcon, MatchesIcon, PinIcon, TrendIcon, UsersIcon } from '@/components/nav/icons';
import { PublicHeader } from '@/components/public-header';
import { Link } from '@/i18n/navigation';
import { toLocale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: toLocale(locale), namespace: 'how' });
  return { title: t('metaTitle'), description: t('intro') };
}

/**
 * Guía de la app, a la que lleva "Ver cómo funciona" de la portada.
 *
 * Cada paso numerado como en un gráfico de transmisión: número grande en
 * dorado, título en mayúsculas y tres puntos concretos. Lo que todavía no
 * existe lleva la etiqueta "Pronto": la guía no promete lo que la app no
 * hace.
 *
 * Estática: se arma en el build y no consulta quién sos.
 */
const STEPS = [
  { key: 'track', Icon: MatchesIcon, soon: false },
  { key: 'stats', Icon: TrendIcon, soon: false },
  { key: 'level', Icon: UsersIcon, soon: false },
  { key: 'venues', Icon: PinIcon, soon: false },
  { key: 'offers', Icon: CalendarIcon, soon: true },
] as const;

export default function HowItWorksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations('how');
  const tDisclaimer = useTranslations('disclaimer');

  return (
    <div className="min-h-dvh overflow-x-clip">
      <PublicHeader />

      <main>
        <section className="mx-auto max-w-4xl px-6 pb-12 pt-10 sm:pt-16">
          <Link
            href="/"
            className="eyebrow inline-flex items-center gap-1 text-fg-secondary hover:text-fg"
          >
            <span aria-hidden="true">←</span> {t('back')}
          </Link>
          <p className="eyebrow mt-8 text-accent">{t('eyebrow')}</p>
          <DisplayTitle text={t('title')} className="mt-3 text-6xl sm:text-8xl" />
          <p className="mt-6 max-w-2xl text-xl text-fg-secondary">{t('intro')}</p>
        </section>

        <ol className="mx-auto max-w-4xl space-y-4 px-6 pb-16">
          {STEPS.map(({ key, Icon, soon }, index) => (
            <li key={key} className="card-glass relative overflow-hidden p-6 sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-8">
                {/* Número de paso, como el de los gráficos de la tele. */}
                <span
                  aria-hidden="true"
                  className="shrink-0 font-display text-5xl font-bold leading-none text-accent sm:w-24 sm:text-7xl"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <Icon className="h-6 w-6 text-accent" />
                    <h2 className="text-2xl sm:text-3xl">{t(`steps.${key}.title`)}</h2>
                    {soon ? (
                      <span className="rounded-md bg-bronze px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-black">
                        {t('soon')}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-lg text-fg-secondary">{t(`steps.${key}.body`)}</p>
                  <ul className="mt-4 space-y-2">
                    {/* En Turnos, el tercer punto es el aviso de que la app no
                        reserva canchas, con el texto oficial (§12.8): esa
                        frase no se reescribe en cada pantalla. */}
                    {(key === 'offers'
                      ? [t('steps.offers.p1'), t('steps.offers.p2'), tDisclaimer('noBooking')]
                      : [t(`steps.${key}.p1`), t(`steps.${key}.p2`), t(`steps.${key}.p3`)]
                    ).map((text) => (
                      <li key={text} className="flex gap-3">
                        <span
                          aria-hidden="true"
                          className="mt-2.5 h-1.5 w-3 shrink-0 rounded-sm bg-accent"
                        />
                        <span>{text}</span>
                      </li>
                    ))}
                  </ul>
                  {key === 'level' ? (
                    <p className="mt-4 inline-flex items-center gap-2 text-sm text-fg-secondary">
                      <span className="rounded-md bg-bronze px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-black">
                        {t('soon')}
                      </span>
                      {t('steps.level.soonNote')}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>

        {/* Privacidad, en la hoja blanca: es lo que más se pregunta. */}
        <section
          aria-labelledby="datos"
          className="rounded-t-[2rem] bg-white text-black"
        >
          <div className="mx-auto max-w-4xl px-6 pb-20 pt-14">
            <h2 id="datos" className="text-4xl sm:text-5xl">
              {t('privacyTitle')}
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-3">
              {(['privacy1', 'privacy2', 'privacy3'] as const).map((k) => (
                <li key={k} className="rounded-card border border-black/10 bg-[#f4f4f4] p-5 text-lg leading-snug">
                  {t(k)}
                </li>
              ))}
            </ul>

            <div className="mt-14 flex flex-wrap items-center justify-between gap-6 rounded-card bg-black p-8 text-white">
              <p className="font-display text-3xl font-bold uppercase sm:text-4xl">{t('ctaTitle')}</p>
              <Link href="/entrar" className="btn-gold touch-target px-8 py-3">
                {t('cta')}
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
