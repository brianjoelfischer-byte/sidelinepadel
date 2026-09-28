import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';

import { OffersSoon } from '@/components/offers/offers-soon';
import { toLocale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: toLocale(locale), namespace: 'nav' });
  return { title: t('offers') };
}

/** Turnos · bloque 9. Por ahora explica lo que viene; ver `OffersSoon`. */
export default async function OffersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  return <OffersSoon />;
}
