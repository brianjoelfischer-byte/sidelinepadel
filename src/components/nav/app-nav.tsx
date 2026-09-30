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
 * Turnos todavía no existe (bloque 9). Va igual, marcado "Pronto": si se
 * agregara recién cuando exista, la barra cambiaría de forma y la gente
 * tendría que volver a aprender dónde está cada cosa. Lleva a una pantalla que
 * explica lo que viene y ya muestra el aviso de que la app no reserva canchas,
 * en el lugar donde después va a estar el formulario (§12.8).
 */

type Destination = {
  key: DestinationKey;
  href: string;
  /** Todavía no construido: se muestra con la etiqueta "Pronto". */
  soon?: boolean;
  Icon: (props: { className?: string }) => React.ReactElement;
};

const DESTINATIONS: Destination[] = [
  { key: 'panel', href: '/panel', Icon: HomeIcon },
  { key: 'sessions', href: '/sesiones', Icon: MatchesIcon },
  { key: 'add', href: '/sesiones/nueva', Icon: PlusIcon },
  { key: 'offers', href: '/turnos', soon: true, Icon: CalendarIcon },
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
        {DESTINATIONS.map(({ key, href, soon, Icon }) => {
          const isActive = active === key;

          // El botón central: más grande y en el acento, como en las apps del
          // rubro. Es la acción que más se repite.
          if (key === 'add') {
            return (
              <li key={key} className="flex justify-center">
                <Link
                  href={href}
                  aria-current={isActive ? 'page' : undefined}
                  className="-mt-5 flex flex-col items-center gap-1"
                >
                  <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white bg-gold-gradient text-white shadow-[2.5px_2.5px_0_#fff] ring-4 ring-bg-base transition-transform active:translate-x-[2.5px] active:translate-y-[2.5px] active:shadow-none motion-reduce:transition-none">
                    <Icon className="h-7 w-7" />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-fg">{label(key)}</span>
                </Link>
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
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  {label(key)}
                  {soon ? <span className="sr-only"> · {t('soon')}</span> : null}
                </span>
                {soon ? (
                  <span
                    aria-hidden="true"
                    className="-mt-0.5 rounded-pill bg-bg-elevated px-1.5 text-[9px] font-semibold uppercase tracking-wider text-fg-muted"
                  >
                    {t('soon')}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="space-y-1">
      {DESTINATIONS.filter((d) => d.key !== 'add').map(({ key, href, soon, Icon }) => {
        const isActive = active === key;

        return (
          <li key={key}>
            <Link
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={
                isActive
                  ? 'flex min-h-11 items-center gap-3 rounded-card border-l-2 border-accent bg-white/10 px-3 font-bold uppercase tracking-wider text-fg'
                  : 'flex min-h-11 items-center gap-3 rounded-card border-l-2 border-transparent px-3 font-bold uppercase tracking-wider text-fg-secondary transition-colors hover:bg-white/5 hover:text-fg'
              }
            >
              <Icon className={isActive ? 'h-5 w-5 text-accent' : 'h-5 w-5'} />
              {label(key)}
              {soon ? (
                <span className="ml-auto rounded-pill bg-bg-elevated px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
                  {t('soon')}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
