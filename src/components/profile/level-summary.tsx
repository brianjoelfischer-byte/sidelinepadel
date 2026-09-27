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
    <section className="rounded-card border border-border bg-bg-surface p-6">
      <div className="flex items-baseline gap-4">
        <span className="font-display text-6xl font-bold leading-none text-accent">
          {formatLevel(effective, locale)}
        </span>
        <div>
          <p className="text-xs uppercase tracking-widest text-fg-muted">
            {t('effective')}
          </p>
          <p className="text-sm text-fg-secondary">{bandLabel}</p>
        </div>
      </div>

      {/* Categoría estimada · secundaria a propósito, y siempre etiquetada
          como aproximación para que nadie la lea como oficial. */}
      {category ? (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-card border border-border bg-bg-elevated px-4 py-3">
          <span className="rounded-pill bg-accent-2/15 px-3 py-1 text-sm font-semibold text-accent-2">
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

      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-6 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wider text-fg-muted">
            {t('declared')}
          </dt>
          <dd className="mt-1 font-semibold">{formatLevel(declared, locale)}</dd>
        </div>

        <div>
          <dt className="text-xs uppercase tracking-wider text-fg-muted">
            {t('perceived')}
          </dt>
          <dd className="mt-1 font-semibold">
            {showPerceived ? formatLevel(perceived, locale) : '—'}
          </dd>
          <dd className="text-xs text-fg-muted">
            {t('raters', { count: raterCount })}
          </dd>
        </div>
      </dl>
    </section>
  );
}
