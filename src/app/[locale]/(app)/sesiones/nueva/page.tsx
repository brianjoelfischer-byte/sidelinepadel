import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';

import { Link } from '@/i18n/navigation';
import { SessionForm } from '@/components/sessions/session-form';
import { toLocale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: toLocale(locale), namespace: 'session' });
  return { title: t('title') };
}

export default async function NewSessionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = toLocale(raw);
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'session' });
  const tCommon = await getTranslations({ locale, namespace: 'common' });

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/panel"
        className="text-sm text-fg-secondary underline-offset-4 hover:underline"
      >
        ← {tCommon('back')}
      </Link>

      <h1 className="mt-6 text-3xl">{t('title')}</h1>

      <div className="mt-10">
        <SessionForm locale={locale} />
      </div>
    </main>
  );
}
