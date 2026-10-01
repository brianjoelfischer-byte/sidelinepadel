import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';

import { DisplayTitle } from '@/components/display-title';
import { Link } from '@/i18n/navigation';
import { SessionForm } from '@/components/sessions/session-form';
import { getProfile, requireUser } from '@/lib/auth/session';
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

  const user = await requireUser(locale);
  const profile = await getProfile(user.id);

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

      <DisplayTitle text={t('title')} className="mt-6 text-5xl" />

      <div className="mt-10">
        <SessionForm
          locale={locale}
          preferCountry={profile?.country_code ?? null}
          myLevel={profile ? Number(profile.effective_level) : 3.5}
        />
      </div>
    </main>
  );
}
