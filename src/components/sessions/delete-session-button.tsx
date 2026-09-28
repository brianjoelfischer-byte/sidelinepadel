'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { deleteSession } from '@/actions/sessions';
import { useRouter } from '@/i18n/navigation';

/**
 * Borrar un partido, en dos pasos.
 *
 * El primer toque solo pregunta. Borrar al primer toque es fácil de hacer sin
 * querer en el celular, y no tiene vuelta atrás: la sesión se va con sus
 * participantes y valoraciones.
 */
export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const t = useTranslations('session');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => {
          setFailed(false);
          setConfirming(true);
        }}
        className="touch-target rounded-pill px-3 text-xs font-semibold text-fg-muted transition-colors hover:text-loss"
      >
        {t('delete')}
      </button>
    );
  }

  return (
    <div role="group" aria-label={t('deleteConfirm')} className="flex flex-col items-end gap-1">
      <span role={failed ? 'alert' : undefined} className="text-xs text-fg-secondary">
        {failed ? t('deleteFailed') : t('deleteConfirm')}
      </span>
      {/* Cancelar primero y borrar a la derecha: la acción que no se
          deshace queda donde el pulgar llega último, no donde apoya primero. */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={isPending}
          onClick={() => setConfirming(false)}
          className="touch-target rounded-pill px-4 text-xs font-semibold text-fg-secondary hover:text-fg"
        >
          {tCommon('cancel')}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              try {
                const result = await deleteSession(sessionId);
                if (result.ok) {
                  router.replace('/sesiones?aviso=borrado');
                  router.refresh();
                  return;
                }
              } catch {
                // Sin respuesta del servidor: mismo aviso que un fallo.
              }
              setFailed(true);
            })
          }
          className="touch-target rounded-pill bg-loss/15 px-4 text-xs font-semibold text-loss transition-colors hover:bg-loss/25 disabled:opacity-60"
        >
          {isPending ? t('deleting') : t('deleteYes')}
        </button>
      </div>
    </div>
  );
}
