import { useTranslations } from 'next-intl';

/**
 * El aviso de §12.8: la app no reserva canchas.
 *
 * Es el malentendido más caro posible: alguien cree que Sideline le reservó la
 * cancha, se presenta y no hay nada. Por eso es un recuadro ámbar con un
 * símbolo, arriba de todo, y no una línea gris al pie.
 *
 * `role="note"`: el lector de pantalla lo anuncia como aclaración, sin
 * interrumpir como haría una alerta.
 */
export function NoBookingNotice() {
  const t = useTranslations('disclaimer');
  return (
    <p
      role="note"
      className="flex items-start gap-3 rounded-card border border-accent-2/50 bg-accent-2/10 px-4 py-3 text-sm text-fg"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-2 text-xs font-bold text-accent-ink"
      >
        !
      </span>
      <span>{t('noBooking')}</span>
    </p>
  );
}
