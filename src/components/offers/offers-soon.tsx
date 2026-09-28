import { useTranslations } from 'next-intl';

import { CalendarIcon, PlusIcon, UsersIcon } from '@/components/nav/icons';
import { Link } from '@/i18n/navigation';

import { NoBookingNotice } from './no-booking-notice';

/**
 * Turnos, mientras no existen (bloque 9): qué va a hacer esta sección.
 *
 * El aviso de que no se reservan canchas ya va arriba, donde después va a
 * estar el formulario para crear un turno. Así el lugar del aviso queda
 * fijado desde ahora y no depende de acordarse cuando se construya.
 */
export function OffersSoon() {
  const t = useTranslations('offers');
  const tNav = useTranslations('nav');

  const steps = [
    { key: 'publish', Icon: CalendarIcon },
    { key: 'join', Icon: UsersIcon },
    { key: 'remind', Icon: BellIcon },
  ] as const;

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 lg:px-10 lg:py-12">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl sm:text-4xl">{tNav('offers')}</h1>
        <span className="rounded-pill bg-bg-elevated px-3 py-1 text-xs font-semibold uppercase tracking-wider text-fg-muted">
          {tNav('soon')}
        </span>
      </div>

      <div className="mt-6">
        <NoBookingNotice />
      </div>

      <section aria-labelledby="como-van-a-funcionar" className="mt-10">
        <h2 id="como-van-a-funcionar" className="text-xl">
          {t('howTitle')}
        </h2>
        <ol className="mt-4 space-y-3">
          {steps.map(({ key, Icon }, i) => (
            <li
              key={key}
              className="flex gap-4 rounded-card border border-border bg-bg-surface p-5"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-card bg-accent/10 text-accent">
                <Icon className="h-6 w-6" />
              </span>
              <div>
                <h3 className="font-semibold">
                  <span className="mr-1.5 text-fg-muted">{i + 1}.</span>
                  {t(`steps.${key}Title`)}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-fg-secondary">
                  {t(`steps.${key}Body`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 rounded-card border border-dashed border-border px-6 py-8 text-center">
        <p className="text-fg-secondary">{t('meanwhile')}</p>
        <Link
          href="/sesiones/nueva"
          className="touch-target mt-5 inline-flex items-center gap-2 rounded-pill bg-accent px-6 font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
        >
          <PlusIcon className="h-5 w-5" />
          {tNav('addSessionLong')}
        </Link>
      </section>
    </main>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Z" />
      <path d="M10 21h4" />
    </svg>
  );
}
