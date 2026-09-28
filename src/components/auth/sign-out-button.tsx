'use client';

import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { signOut } from '@/actions/auth';
import { useRouter } from '@/i18n/navigation';

export function SignOutButton() {
  const t = useTranslations('nav');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            await signOut();
          } catch {
            // Sin respuesta del servidor la sesión sigue abierta: no se
            // redirige, para no mostrar la portada como si hubiera salido.
            return;
          }
          router.replace('/');
          // La sesión vive en cookies que lee el servidor: sin refresh, un
          // Server Component cacheado podría seguir mostrando datos del
          // usuario que acaba de salir.
          router.refresh();
        })
      }
      className="touch-target rounded-pill border border-border px-4 text-sm font-semibold text-fg-secondary transition-colors hover:text-fg disabled:opacity-60"
    >
      {t('signOut')}
    </button>
  );
}
