import { getTranslations } from 'next-intl/server';

import {
  categoryRange,
  formatLevel,
  levelBand,
  localCategory,
} from '@/lib/levels/scale';

/**
 * Los tres niveles del §12.1, juntos y a la vista.
 *
 * Que se muestren los tres es el punto: si alguien declara 5.0 y el percibido
 * dice 3.8, cualquiera lo nota antes de invitarlo. Ocultarlo convertiría el
 * sistema en una caja negra y le quitaría la utilidad.
 *
 * El número 1–7 manda. La categoría estimada va al lado, en chico y siempre
 * marcada como aproximación: la categoría real sale de resultados en torneos
 * federados, no de cómo jugás un martes, y hay gente sin categoría porque
 * nunca compitió.
 */
export async function LevelSummary({
  declared,
  perceived,
  effective,
  raterCount,
  countryCode,
  locale,
}: {
  declared: number;
  perceived: number | null;
  effective: number;
  raterCount: number;
  countryCode: string;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: 'level' });

  const category = localCategory(effective, countryCode);
  const range = categoryRange(effective, countryCode);
  const bandLabel = t(`scale.${levelBand(effective)}` as 'scale.intermediate');

  /**
   * Con menos de 3 votantes el percibido no se publica: un solo voto no
   * debería definir la reputación de nadie. Se sigue calculando y ya pesa en
   * el efectivo — lo que se oculta es el número suelto, que sin contexto
   * confunde más de lo que informa.
   */
  const showPerceived = perceived !== null && raterCount >= 3;

  return (
    <section className="card-glass overflow-hidden">
      {/* El número, en tarjeta dorada: la ficha de jugador de la tele. */}
      <div className="bg-gold-card flex items-end gap-4 border-b border-white/30 px-6 py-5">
        <span className="font-display text-7xl font-bold leading-none text-white">
          {formatLevel(effective, locale)}
        </span>
        <div className="pb-1">
          <p className="eyebrow text-white">{t('effective')}</p>
          <p className="text-base font-semibold uppercase tracking-wide text-white">
            {bandLabel}
          </p>
        </div>
      </div>

      <div className="px-6 pb-6">

      {/* Categoría estimada · secundaria a propósito, y siempre etiquetada
          como aproximación para que nadie la lea como oficial. */}
      {category ? (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-4 py-3">
          <span className="rounded-md bg-bronze px-2.5 py-1 text-sm font-bold uppercase text-black">
            ≈ {category}
          </span>
          <span className="text-xs text-fg-muted">
            {range
              ? t('categoryApproxWithRange', {
                  min: formatLevel(range.min, locale),
                  max: formatLevel(range.max, locale),
                })
              : t('categoryApprox')}
          </span>
        </div>
      ) : null}

      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-6 text-sm">
        <div>
          <dt className="eyebrow text-fg-muted">{t('declared')}</dt>
          <dd className="mt-1 font-display text-2xl font-bold">{formatLevel(declared, locale)}</dd>
        </div>

        <div>
          <dt className="eyebrow text-fg-muted">{t('perceived')}</dt>
          <dd className="mt-1 font-display text-2xl font-bold">
            {showPerceived ? formatLevel(perceived, locale) : '—'}
          </dd>
          <dd className="text-xs text-fg-muted">
            {t('raters', { count: raterCount })}
          </dd>
        </div>
      </dl>
      </div>
    </section>
  );
}
