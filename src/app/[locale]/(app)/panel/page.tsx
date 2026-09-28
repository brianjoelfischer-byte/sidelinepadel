import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';

import { Notice } from '@/components/notice';
import { PanelView, type RecentSession } from '@/components/panel/panel-view';
import { LevelSummary } from '@/components/profile/level-summary';
import { getProfile, requireUser } from '@/lib/auth/session';
import { toLocale } from '@/i18n/routing';
import type { SetScore } from '@/lib/sessions/score';
import { noticeFrom } from '@/lib/notice';
import { loadVenueLabels, venueFor } from '@/lib/sessions/venue-names';
import { createClient } from '@/lib/supabase/server';
import { summarize } from '@/lib/stats/summary';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: toLocale(locale), namespace: 'nav' });
  return { title: t('panel') };
}

/** "Hoy" en la zona del jugador, no la del servidor (que en Vercel es UTC). */
function todayIn(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export default async function PanelPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ aviso?: string | string[] }>;
}) {
  const { locale: raw } = await params;
  const notice = noticeFrom((await searchParams).aviso);
  const locale = toLocale(raw);
  setRequestLocale(locale);

  const user = await requireUser(locale);
  const profile = await getProfile(user.id);
  if (!profile) return null; // el layout ya redirige; esto es para el tipo

  /**
   * Solo las sesiones que cargaste vos. Las que confirmaste de otro también
   * son visibles, pero su `result` está escrito desde el lado de quien las
   * cargó: una victoria suya puede ser tu derrota. Mezclarlas daría un
   * porcentaje falso. Cuando el etiquetado esté en pantalla, se invierten.
   */
  const supabase = await createClient();
  const { data } = await supabase
    .from('sessions')
    .select('id, kind, played_on, created_at, result, sets, venue_id, venue_freetext')
    .eq('owner_id', user.id)
    .order('played_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500);

  const sessions = data ?? [];
  const today = todayIn(profile.timezone);
  const summary = summarize(sessions, { today });

  const latest = sessions.slice(0, 3);
  const labels = await loadVenueLabels(supabase, latest.map((s) => s.venue_id));
  const recent: RecentSession[] = latest.map((s) => ({
    id: s.id,
    kind: s.kind,
    playedOn: s.played_on,
    result: s.result,
    sets: (s.sets as unknown as SetScore[] | null) ?? null,
    venue: venueFor(s, labels),
  }));

  const firstName = profile.display_name.trim().split(/\s+/)[0] ?? profile.display_name;

  return (
    <>
      {notice ? <Notice kind={notice} /> : null}
      <PanelView
      firstName={firstName}
      today={today}
      summary={summary}
      recent={recent}
      level={
        <LevelSummary
          declared={Number(profile.declared_level)}
          perceived={profile.perceived_level === null ? null : Number(profile.perceived_level)}
          effective={Number(profile.effective_level)}
          raterCount={profile.rater_count}
          countryCode={profile.country_code}
          locale={locale}
        />
      }
    />
    </>
  );
}
