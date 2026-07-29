import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';

import { LoginForm } from '@/components/auth/login-form';
import { Logo } from '@/components/logo';
import { getUser } from '@/lib/auth/session';
import { hasSupabaseConfig } from '@/lib/env';
import { redirect } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('title') };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'auth' });

  // Sin Supabase configurado no hay login posible. Se dice explícitamente en
  // vez de mostrar un formulario que no va a funcionar — o peor, un 500.
  if (!hasSupabaseConfig()) {
    return (
      <main className="grid min-h-dvh place-items-center px-6">
        <div className="max-w-md text-center">
          <Logo />
          <p className="mt-8 rounded-card border border-accent-2/40 bg-accent-2/5 px-4 py-3 text-sm text-fg-secondary">
            Supabase no está configurado. Copiá <code>.env.example</code> a{' '}
            <code>.env.local</code> y completá{' '}
            <code>NEXT_PUBLIC_SUPABASE_URL</code> y{' '}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
          </p>
        </div>
      </main>
    );
  }

  // Ya autenticado: no tiene sentido mostrarle el login.
  const user = await getUser();
  if (user) redirect({ href: '/panel', locale });

  const { error } = await searchParams;

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Logo />
        </div>

        <h1 className="mt-10 text-center text-3xl">{t('title')}</h1>
        <p className="mt-3 text-center text-fg-secondary">{t('subtitle')}</p>

        <LoginForm locale={locale} initialError={error} />

        <p className="mt-8 text-center text-xs leading-relaxed text-fg-muted">
          {t('minAge')}
          <br />
          {t('legal')}
        </p>
      </div>
    </main>
  );
}
