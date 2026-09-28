'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { usePathname, useRouter } from '@/i18n/navigation';
import type { NoticeKind } from '@/lib/notice';

/**
 * Aviso breve después de una acción: "Partido guardado", "Partido borrado".
 *
 * Llega por la URL (`?aviso=guardado`) y no por estado en memoria: así
 * sobrevive a la redirección que hace la acción, y no hace falta nada
 * guardado en el navegador. Se va solo a los 4 segundos y limpia la URL, para
 * que recargar la página no lo muestre de nuevo.
 */
export function Notice({ kind }: { kind: NoticeKind }) {
  const t = useTranslations('panel');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOpen(false);
      router.replace(pathname, { scroll: false });
    }, 4000);
    return () => clearTimeout(timer);
  }, [router, pathname]);

  if (!open) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-20 z-40 flex justify-center px-4 lg:top-6 lg:pl-64"
    >
      <div className="flex items-center gap-3 rounded-pill border border-win/30 bg-bg-elevated py-2 pl-4 pr-2 shadow-lg shadow-black/40">
        <span aria-hidden="true" className="text-win">
          ✓
        </span>
        <span className="text-sm font-semibold">
          {kind === 'guardado' ? t('saved') : t('deleted')}
        </span>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            router.replace(pathname, { scroll: false });
          }}
          aria-label={tCommon('close')}
          className="grid h-8 w-8 place-items-center rounded-full text-fg-muted hover:text-fg"
        >
          ×
        </button>
      </div>
    </div>
  );
}
