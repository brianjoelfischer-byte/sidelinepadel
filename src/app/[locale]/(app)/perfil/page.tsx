import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { LevelSummary } from '@/components/profile/level-summary';
import { toLocale } from '@/i18n/routing';
import { getProfile, requireUser } from '@/lib/auth/session';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: toLocale(locale), namespace: 'nav' });
  return { title: t('profile') };
}

/**
 * Tu perfil: quién sos en la app, tu nivel, cómo jugás, y la cuenta.
 *
 * Por ahora de solo lectura, salvo el idioma y cerrar sesión. Editar los
 * datos y cambiar el nivel declarado (con su espera de 14 días) es el resto
 * del bloque 4. Cerrar sesión vive acá porque es donde se lo busca; antes
 * solo estaba en el panel.
 */
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = toLocale(raw);
  setRequestLocale(locale);

  const user = await requireUser(locale);
  const profile = await getProfile(user.id);
  if (!profile) return null; // el layout ya redirige

  const t = await getTranslations({ locale, namespace: 'profile' });
  const tGame = await getTranslations({ locale, namespace: 'onboarding.game' });

  const country =
    new Intl.DisplayNames([locale], { type: 'region' }).of(profile.country_code) ??
    profile.country_code;
  const initial = profile.display_name.trim().charAt(0).toUpperCase() || '·';

  const side =
    profile.preferred_side === 'drive'
      ? tGame('drive')
      : profile.preferred_side === 'reves'
        ? tGame('reves')
        : profile.preferred_side === 'indistinto'
          ? tGame('indistinto')
          : null;
  const hand =
    profile.preferred_hand === 'left'
      ? tGame('left')
      : profile.preferred_hand === 'right'
        ? tGame('right')
        : null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 lg:px-10 lg:py-12">
      {/* ── Identidad ──────────────────────────────────────────────────── */}
      <header className="flex items-center gap-5">
        <span
          aria-hidden="true"
          className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-bg-elevated font-display text-4xl font-bold text-accent ring-2 ring-accent/30"
        >
          {initial}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-3xl">{profile.display_name}</h1>
          <p className="mt-1 text-sm text-fg-muted">
            @{profile.slug} · {country}
          </p>
          <p className="mt-2">
            <span
              className={
                profile.is_public
                  ? 'rounded-pill bg-win/10 px-2.5 py-0.5 text-xs font-semibold text-win'
                  : 'rounded-pill bg-bg-elevated px-2.5 py-0.5 text-xs font-semibold text-fg-secondary'
              }
            >
              {profile.is_public ? t('public') : t('private')}
            </span>
          </p>
        </div>
      </header>

      {/* ── Nivel ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="nivel" className="mt-10">
        <h2 id="nivel" className="text-xl">
          {t('level')}
        </h2>
        <div className="mt-4">
          <LevelSummary
            declared={Number(profile.declared_level)}
            perceived={profile.perceived_level === null ? null : Number(profile.perceived_level)}
            effective={Number(profile.effective_level)}
            raterCount={profile.rater_count}
            countryCode={profile.country_code}
            locale={locale}
          />
        </div>
      </section>

      {/* ── Juego ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="juego" className="mt-10">
        <h2 id="juego" className="text-xl">
          {t('game')}
        </h2>
        <dl className="mt-4 divide-y divide-border rounded-card border border-border bg-bg-surface">
          <Row label={tGame('sideLabel')} value={side ?? t('notSet')} />
          <Row label={tGame('handLabel')} value={hand ?? t('notSet')} />
          <Row label={t('racket')} value={profile.racket ?? t('notSet')} />
        </dl>
      </section>

      {/* ── Preferencias y cuenta ─────────────────────────────────────── */}
      <section aria-labelledby="cuenta" className="mt-10">
        <h2 id="cuenta" className="text-xl">
          {t('account')}
        </h2>
        <div className="mt-4 divide-y divide-border rounded-card border border-border bg-bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <span className="text-sm text-fg-secondary">{t('language')}</span>
            <LocaleSwitcher />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <span className="min-w-0">
              <span className="block text-sm text-fg-secondary">{t('email')}</span>
              <span className="block truncate">{user.email}</span>
            </span>
            <SignOutButton />
          </div>
        </div>
        <p className="mt-3 text-xs text-fg-muted">{t('editSoon')}</p>
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <dt className="text-sm text-fg-secondary">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
