import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LevelSummary } from '@/components/profile/level-summary';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { getProfile, requireUser } from '@/lib/auth/session';
import { toLocale } from '@/i18n/routing';

/**
 * Panel mínimo. Existe para que el flujo de alta cierre en algún lado — el
 * dashboard de verdad (estadísticas, racha, forma reciente) es el bloque 6.
 */
export default async function PanelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = toLocale(raw);
  setRequestLocale(locale);

  const user = await requireUser(locale);
  const profile = await getProfile(user.id);
  const t = await getTranslations({ locale, namespace: 'nav' });

  if (!profile) return null; // el layout ya redirige; esto es para el tipo

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="flex items-center justify-between">
        <Logo />
        <SignOutButton />
      </header>

      <h1 className="mt-12 text-3xl">{profile.display_name}</h1>
      <p className="mt-1 text-sm text-fg-muted">/{profile.slug}</p>

      <div className="mt-8">
        <LevelSummary
          declared={Number(profile.declared_level)}
          perceived={
            profile.perceived_level === null ? null : Number(profile.perceived_level)
          }
          effective={Number(profile.effective_level)}
          raterCount={profile.rater_count}
          countryCode={profile.country_code}
          locale={locale}
        />
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/sesiones/nueva"
          className="touch-target grid place-items-center rounded-pill bg-accent px-6 font-semibold text-accent-ink"
        >
          {t('addSession')}
        </Link>
        <Link
          href="/sesiones"
          className="touch-target grid place-items-center rounded-pill border border-border px-6 font-semibold"
        >
          {t('sessions')}
        </Link>
      </div>
    </main>
  );
}
