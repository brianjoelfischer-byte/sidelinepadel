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
          className="btn-gold touch-target mt-8 px-6"
        >
          {t('backHome')}
        </Link>
      </div>
    </main>
  );
}
