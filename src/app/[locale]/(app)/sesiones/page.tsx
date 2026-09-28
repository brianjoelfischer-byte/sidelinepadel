import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';

import { PlusIcon } from '@/components/nav/icons';
import { Notice } from '@/components/notice';
import { DeleteSessionButton } from '@/components/sessions/delete-session-button';
import { ResultBadge } from '@/components/sessions/result-badge';
import { Scoreboard } from '@/components/sessions/scoreboard';
import { VenueLink } from '@/components/sessions/venue-link';
import { Link } from '@/i18n/navigation';
import { toLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth/session';
import { noticeFrom } from '@/lib/notice';
import type { SetScore } from '@/lib/sessions/score';
import { loadVenueLabels, venueFor } from '@/lib/sessions/venue-names';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: toLocale(locale), namespace: 'nav' });
  return { title: t('sessions') };
}

/**
 * Historial propio.
 *
 * Muestra las sesiones que el usuario registró y las que confirmó de otros —
 * exactamente lo que deja ver la política de RLS, sin filtro extra acá. Que la
 * consulta y el permiso digan lo mismo es a propósito: si la política cambia,
 * la pantalla la sigue sin tocarla.
 *
 * Borrar se ofrece solo en las propias: la base igual lo impediría en las
 * ajenas, pero un botón que siempre falla es peor que no tenerlo.
 */
export default async function SessionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ aviso?: string | string[] }>;
}) {
  const { locale: raw } = await params;
  const locale = toLocale(raw);
  setRequestLocale(locale);

  const user = await requireUser(locale);
  const notice = noticeFrom((await searchParams).aviso);

  const t = await getTranslations({ locale, namespace: 'session' });
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const format = await getFormatter({ locale });

  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, owner_id, kind, played_on, result, sets, venue_id, venue_freetext, notes')
    .order('played_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);

  const labels = await loadVenueLabels(supabase, (sessions ?? []).map((s) => s.venue_id));

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 lg:px-10 lg:py-12">
      {notice ? <Notice kind={notice} /> : null}

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl sm:text-4xl">{tNav('sessions')}</h1>
        {/* En el celular el botón central de la barra ya registra; acá
            sobraría. En escritorio, la barra lateral lo tiene arriba, pero
            al lado del título es donde se lo busca. */}
        <Link
          href="/sesiones/nueva"
          className="touch-target hidden items-center gap-2 rounded-pill bg-accent px-5 font-semibold text-accent-ink transition-colors hover:bg-accent-hover sm:inline-flex"
        >
          <PlusIcon className="h-5 w-5" />
          {tNav('addSession')}
        </Link>
      </div>

      {sessions && sessions.length > 0 ? (
        <ul className="mt-8 space-y-3">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="rounded-card border border-border bg-bg-surface p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-fg-secondary">
                    {format.dateTime(new Date(session.played_on), {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  <div className="mt-1">
                    <VenueLink venue={venueFor(session, labels)} label={t('openInMaps')} />
                  </div>
                </div>
                <ResultBadge result={session.result} />
              </div>

              {session.sets ? (
                <div className="mt-4">
                  <Scoreboard sets={session.sets as unknown as SetScore[]} />
                </div>
              ) : null}

              {session.notes ? (
                <p className="mt-3 text-sm text-fg-secondary">{session.notes}</p>
              ) : null}

              {session.owner_id === user.id ? (
                <div className="mt-3 flex justify-end border-t border-border/60 pt-2">
                  <DeleteSessionButton sessionId={session.id} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-12 rounded-card border border-dashed border-border bg-bg-surface p-10 text-center">
          <p className="text-fg-secondary">{t('empty')}</p>
          <Link
            href="/sesiones/nueva"
            className="touch-target mt-6 inline-flex items-center gap-2 rounded-pill bg-accent px-6 font-semibold text-accent-ink"
          >
            <PlusIcon className="h-5 w-5" />
            {tNav('addSession')}
          </Link>
        </div>
      )}
    </main>
  );
}
