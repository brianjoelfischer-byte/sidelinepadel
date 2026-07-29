import { getTranslations } from 'next-intl/server';

import { formatLevel, levelBand, localCategory } from '@/lib/levels/scale';

/**
 * Los tres niveles del §12.1, juntos y a la vista.
 *
 * Que se muestren los tres es el punto: si alguien declara 5.0 y el percibido
 * dice 3.8, cualquiera lo nota antes de invitarlo. Ocultarlo convertiría el
 * sistema en una caja negra y le quitaría la utilidad.
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

  const category =
    localCategory(effective, countryCode) ??
    t(`scale.${levelBand(effective)}` as 'scale.intermediate');

  /**
   * Con menos de 3 votantes el percibido no se publica: un solo voto no
   * debería definir la reputación de nadie. Se sigue calculando y ya pesa en
   * el efectivo — lo que se oculta es el número suelto, que sin contexto
   * confunde más de lo que informa.
   */
  const showPerceived = perceived !== null && raterCount >= 3;

  return (
    <section className="rounded-card border border-border bg-bg-surface p-6">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-5xl font-bold text-accent">
          {formatLevel(effective, locale)}
        </span>
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-fg-secondary">
            {category}
          </p>
          <p className="text-xs text-fg-muted">{t('effective')}</p>
        </div>
      </div>

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
