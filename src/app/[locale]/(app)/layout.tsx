import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

import { getProfile, requireUser } from '@/lib/auth/session';
import { redirect } from '@/i18n/navigation';
import { toLocale } from '@/i18n/routing';

/**
 * Guard de sesión de toda la app autenticada.
 *
 * Vive en el layout y no página por página a propósito: así una pantalla nueva
 * **nace protegida**, en vez de nacer abierta hasta que alguien se acuerde de
 * agregarle el chequeo. Es la diferencia entre olvidarse y que no se pueda.
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = toLocale(raw);
  setRequestLocale(locale);

  const user = await requireUser(locale);

  // Autenticado pero sin perfil: quedó a mitad del alta. No puede usar la app
  // hasta terminar, porque el perfil es lo que verifica la edad.
  const profile = await getProfile(user.id);
  if (!profile) redirect({ href: '/onboarding', locale });

  return <>{children}</>;
}
