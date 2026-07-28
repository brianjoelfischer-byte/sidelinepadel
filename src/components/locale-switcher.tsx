'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { Link, usePathname } from '@/i18n/navigation';
import { locales } from '@/i18n/routing';

/**
 * Cambio de idioma. Son enlaces reales, no un `router.push`: funcionan sin
 * JS, se pueden abrir en otra pestaña y los indexa el buscador.
 */
export function LocaleSwitcher() {
  const active = useLocale();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('common');

  return (
    <nav aria-label={t('language')} className="flex items-center gap-1">
      {locales.map((locale) => {
        const isActive = locale === active;
        return (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            hrefLang={locale}
            aria-current={isActive ? 'true' : undefined}
            onNavigate={() => startTransition(() => {})}
            data-pending={isPending ? '' : undefined}
            className={
              isActive
                ? 'touch-target grid place-items-center rounded-pill bg-accent px-3 text-sm font-semibold text-accent-ink'
                : 'touch-target grid place-items-center rounded-pill px-3 text-sm font-semibold text-fg-secondary transition-colors hover:text-fg'
            }
          >
            {locale.toUpperCase()}
          </Link>
        );
      })}
    </nav>
  );
}
