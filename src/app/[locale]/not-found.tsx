import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('errors');

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-3xl">{t('notFoundTitle')}</h1>
        <p className="mt-3 text-fg-secondary">{t('notFoundBody')}</p>
        <Link
          href="/"
          className="touch-target mt-8 inline-grid place-items-center rounded-pill bg-accent px-6 font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
        >
          {t('backHome')}
        </Link>
      </div>
    </main>
  );
}
