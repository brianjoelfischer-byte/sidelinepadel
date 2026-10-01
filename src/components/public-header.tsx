import { useTranslations } from 'next-intl';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Logo } from '@/components/logo';
import { Link } from '@/i18n/navigation';

/**
 * Cabecera de las páginas públicas (portada y "Cómo funciona"): negra, con
 * el filete dorado abajo, como la de las transmisiones. La marca vuelve a la
 * portada.
 */
export function PublicHeader() {
  const t = useTranslations('landing');

  return (
    <header className="sticky top-0 z-30 bg-gradient-to-b from-[#1a1a1a] to-black shadow-[0_1px_0_0_var(--color-accent)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" aria-label={t('home')} className="min-w-0">
          <Logo />
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <LocaleSwitcher />
          <Link href="/entrar" className="btn-dark touch-target px-5 text-sm">
            {t('signIn')}
          </Link>
        </div>
      </div>
    </header>
  );
}
