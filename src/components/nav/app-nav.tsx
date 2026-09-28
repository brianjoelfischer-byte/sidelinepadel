'use client';

import { useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';

import { activeDestination, type DestinationKey } from './active';
import { CalendarIcon, HomeIcon, MatchesIcon, PlusIcon, UserIcon } from './icons';

/**
 * Navegación principal · §07.
 *
 * Cinco destinos, en el orden que fija el diseño: Inicio · Partidos ·
 * + Registrar · Turnos · Perfil. En el celular es una barra inferior; en
 * escritorio, la misma lista en la barra lateral. Una sola definición para las
 * dos, así nunca muestran destinos distintos.
 *
 * Turnos todavía no existe (bloque 9). Va igual, marcado "Pronto" y sin
 * enlace: si se agregara recién cuando exista, la barra cambiaría de forma y
 * la gente tendría que volver a aprender dónde está cada cosa.
 */

type Destination = {
  key: DestinationKey;
  href: string | null;
  Icon: (props: { className?: string }) => React.ReactElement;
};

const DESTINATIONS: Destination[] = [
  { key: 'panel', href: '/panel', Icon: HomeIcon },
  { key: 'sessions', href: '/sesiones', Icon: MatchesIcon },
  { key: 'add', href: '/sesiones/nueva', Icon: PlusIcon },
  { key: 'offers', href: null, Icon: CalendarIcon },
  { key: 'profile', href: '/perfil', Icon: UserIcon },
];

export function AppNav({ variant }: { variant: 'bar' | 'sidebar' }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const active = activeDestination(pathname);

  const label = (key: Destination['key']) =>
    key === 'panel'
      ? t('panel')
      : key === 'sessions'
        ? t('sessionsShort')
        : key === 'add'
          ? t('addSession')
          : key === 'offers'
            ? t('offers')
            : t('profile');

  if (variant === 'bar') {
    return (
      <ul className="grid grid-cols-5 items-end">
        {DESTINATIONS.map(({ key, href, Icon }) => {
          const isActive = active === key;

          // El botón central: más grande y en el acento, como en las apps del
          // rubro. Es la acción que más se repite.
          if (key === 'add' && href) {
            return (
              <li key={key} className="flex justify-center">
                <Link
                  href={href}
                  aria-current={isActive ? 'page' : undefined}
                  className="-mt-5 flex flex-col items-center gap-1"
                >
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-ink shadow-lg shadow-black/40 ring-4 ring-bg-base transition-transform active:scale-95 motion-reduce:transition-none">
                    <Icon className="h-7 w-7" />
                  </span>
                  <span className="text-[11px] font-semibold text-fg">{label(key)}</span>
                </Link>
              </li>
            );
          }

          if (!href) {
            return (
              <li key={key} className="flex justify-center">
                <span
                  aria-disabled="true"
                  className="flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-fg-muted/60"
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-[11px] font-medium">
                    {label(key)}
                    <span className="sr-only"> · {t('soon')}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="-mt-0.5 rounded-pill bg-bg-elevated px-1.5 text-[9px] font-semibold uppercase tracking-wider text-fg-muted"
                  >
                    {t('soon')}
                  </span>
                </span>
              </li>
            );
          }

          return (
            <li key={key} className="flex justify-center">
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={
                  isActive
                    ? 'relative flex min-h-14 w-full flex-col items-center justify-center gap-1 text-accent'
                    : 'relative flex min-h-14 w-full flex-col items-center justify-center gap-1 text-fg-secondary transition-colors hover:text-fg'
                }
              >
                {/* Indicador del activo: forma además de color (§10). */}
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-accent"
                  />
                ) : null}
                <Icon className="h-6 w-6" />
                <span className="text-[11px] font-semibold">{label(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="space-y-1">
      {DESTINATIONS.filter((d) => d.key !== 'add').map(({ key, href, Icon }) => {
        const isActive = active === key;

        if (!href) {
          return (
            <li key={key}>
              <span
                aria-disabled="true"
                className="flex min-h-11 items-center gap-3 rounded-card px-3 text-fg-muted/70"
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{label(key)}</span>
                <span className="ml-auto rounded-pill bg-bg-elevated px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
                  {t('soon')}
                </span>
              </span>
            </li>
          );
        }

        return (
          <li key={key}>
            <Link
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={
                isActive
                  ? 'flex min-h-11 items-center gap-3 rounded-card bg-bg-elevated px-3 font-semibold text-fg'
                  : 'flex min-h-11 items-center gap-3 rounded-card px-3 font-medium text-fg-secondary transition-colors hover:bg-bg-surface hover:text-fg'
              }
            >
              <Icon className={isActive ? 'h-5 w-5 text-accent' : 'h-5 w-5'} />
              {label(key)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
