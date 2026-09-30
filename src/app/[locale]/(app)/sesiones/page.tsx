import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';

import { DisplayTitle } from '@/components/display-title';
import { PlusIcon } from '@/components/nav/icons';
import { Notice } from '@/components/notice';
import { DeleteSessionButton } from '@/components/sessions/delete-session-button';
import { SessionCard } from '@/components/sessions/session-card';
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

      <div className="flex items-end justify-between gap-4">
        <DisplayTitle text={tNav('sessions')} className="text-5xl sm:text-6xl" />
        {/* En el celular el botón central de la barra ya registra; acá
            sobraría. En escritorio, la barra lateral lo tiene arriba, pero
            al lado del título es donde se lo busca. */}
        <Link
          href="/sesiones/nueva"
          className="btn-gold touch-target hidden gap-2 px-5 sm:inline-flex"
        >
          <PlusIcon className="h-5 w-5" />
          {tNav('addSession')}
        </Link>
      </div>

      {sessions && sessions.length > 0 ? (
        <ul className="mt-8 space-y-3">
          {sessions.map((session) => (
            <li key={session.id}>
              <SessionCard
                playedOn={session.played_on}
                kind={session.kind}
                result={session.result}
                sets={(session.sets as unknown as SetScore[] | null) ?? null}
                venue={venueFor(session, labels)}
                notes={session.notes}
                footer={
                  session.owner_id === user.id ? (
                    <DeleteSessionButton sessionId={session.id} />
                  ) : undefined
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="card-glass mt-12 p-10 text-center">
          <p className="text-fg-secondary">{t('empty')}</p>
          <Link
            href="/sesiones/nueva"
            className="btn-gold touch-target mt-6 gap-2 px-6"
          >
            <PlusIcon className="h-5 w-5" />
            {tNav('addSession')}
          </Link>
        </div>
      )}
    </main>
  );
}
