import { setRequestLocale } from 'next-intl/server';

import { Logo } from '@/components/logo';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { getProfile, requireUser } from '@/lib/auth/session';
import { redirect } from '@/i18n/navigation';
import { toLocale } from '@/i18n/routing';

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = toLocale(raw);
  setRequestLocale(locale);

  const user = await requireUser(locale);

  // El onboarding se completa una sola vez. Volver acá con perfil ya creado
  // significa que el usuario navegó a mano: se lo manda al panel.
  const profile = await getProfile(user.id);
  if (profile) redirect({ href: '/panel', locale });

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center">
          <Logo />
        </div>
        <div className="mt-12">
          <OnboardingFlow
            locale={locale}
            defaultCountry={locale === 'es' ? 'AR' : 'ES'}
          />
        </div>
      </div>
    </main>
  );
}
