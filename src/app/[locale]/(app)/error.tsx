'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { Link } from '@/i18n/navigation';

/**
 * Si una pantalla de la app falla, esto reemplaza solo el contenido: la
 * navegación sigue, así se puede ir a otro lado sin recargar.
 *
 * Next 16 le pasa `retry` (en versiones anteriores se llamaba `reset`): vuelve
 * a pedir los datos y a dibujar la pantalla.
 *
 * El detalle del error NO se muestra: puede traer datos internos. Queda en la
 * consola del navegador y, con el `digest`, se busca en los logs del servidor.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations('errors');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto grid min-h-[60dvh] max-w-md place-items-center px-6 text-center">
      <div>
        <p aria-hidden="true" className="font-display text-5xl text-accent-2">
          !
        </p>
        <h1 className="mt-4 text-2xl">{t('crashTitle')}</h1>
        <p className="mt-3 text-fg-secondary">{t('crashBody')}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => retry()}
            className="touch-target rounded-pill bg-accent px-6 font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
          >
            {tCommon('retry')}
          </button>
          <Link
            href="/panel"
            className="touch-target inline-grid place-items-center rounded-pill border border-border px-6 font-semibold"
          >
            {tNav('panel')}
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-6 font-mono text-[11px] text-fg-muted">ref {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
