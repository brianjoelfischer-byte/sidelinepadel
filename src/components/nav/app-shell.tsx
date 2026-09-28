import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Logo } from '@/components/logo';
import { Link } from '@/i18n/navigation';
import { formatLevel } from '@/lib/levels/scale';

import { AppNav } from './app-nav';
import { PlusIcon } from './icons';

/**
 * Marco de toda la app autenticada.
 *
 * Celular: barra superior mínima (la marca, que lleva al inicio) y la barra
 * inferior con los cinco destinos. Escritorio: barra lateral fija con los
 * mismos destinos, el botón de registrar a la vista y tu nombre abajo.
 *
 * Vive en el layout de `(app)`, igual que el guard de sesión: una pantalla
 * nueva nace con navegación, no depende de que alguien se acuerde de ponerla.
 * Fue exactamente lo que faltó hasta ahora — "Mis partidos" no tenía forma de
 * volver al inicio.
 */
export function AppShell({
  children,
  displayName,
  effectiveLevel,
}: {
  children: ReactNode;
  displayName: string;
  effectiveLevel: number;
}) {
  const t = useTranslations('nav');
  const locale = useLocale();
  const initial = displayName.trim().charAt(0).toUpperCase() || '·';

  return (
    <div className="min-h-dvh">
      {/* Primer elemento enfocable: con Tab se salta la navegación entera. */}
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-accent-ink"
      >
        {t('skipToContent')}
      </a>

      {/* ── Escritorio: barra lateral ───────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-bg-base px-4 py-6 lg:flex">
        <Link href="/panel" aria-label={t('panel')} className="px-3">
          <Logo />
        </Link>

        <Link
          href="/sesiones/nueva"
          className="touch-target mt-8 flex items-center justify-center gap-2 rounded-pill bg-accent px-4 font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
        >
          <PlusIcon className="h-5 w-5" />
          {t('addSessionLong')}
        </Link>

        <nav aria-label={t('main')} className="mt-8">
          <AppNav variant="sidebar" />
        </nav>

        <Link
          href="/perfil"
          className="mt-auto flex items-center gap-3 rounded-card p-3 transition-colors hover:bg-bg-surface"
        >
          <span
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bg-elevated font-display font-bold text-accent"
          >
            {initial}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{displayName}</span>
            <span className="block text-xs text-fg-muted">
              {t('levelLabel', { level: formatLevel(effectiveLevel, locale) })}
            </span>
          </span>
        </Link>
      </aside>

      {/* ── Celular: barra superior ─────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-bg-base/85 px-5 py-3 backdrop-blur lg:hidden">
        <Link href="/panel" aria-label={t('panel')}>
          <Logo />
        </Link>
        <Link
          href="/perfil"
          aria-label={t('profile')}
          className="grid h-10 w-10 place-items-center rounded-full bg-bg-elevated font-display font-bold text-accent"
        >
          {initial}
        </Link>
      </header>

      {/* ── Contenido ───────────────────────────────────────────────────── */}
      {/* Deja lugar abajo para la barra del celular, más el borde seguro del
          iPhone, así el último elemento de cada pantalla no queda tapado. */}
      <div
        id="contenido"
        tabIndex={-1}
        className="pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none lg:pb-0 lg:pl-64"
      >
        {children}
      </div>

      {/* ── Celular: barra inferior ─────────────────────────────────────── */}
      <nav
        aria-label={t('main')}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg-base/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <AppNav variant="bar" />
      </nav>
    </div>
  );
}
