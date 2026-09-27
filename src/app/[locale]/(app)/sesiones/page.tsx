import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { Scoreboard } from '@/components/sessions/scoreboard';
import type { SetScore } from '@/lib/sessions/score';
import { mapsSearchUrl } from '@/lib/venues/maps';
import { requireUser } from '@/lib/auth/session';
import { toLocale } from '@/i18n/routing';

/**
 * Historial propio.
 *
 * Muestra las sesiones que el usuario registró y las que confirmó de otros —
 * exactamente lo que deja ver la política de RLS, sin filtro extra acá. Que la
 * consulta y el permiso digan lo mismo es a propósito: si la política cambia,
 * la pantalla la sigue sin tocarla.
 */
export default async function SessionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = toLocale(raw);
  setRequestLocale(locale);

  await requireUser(locale);

  const t = await getTranslations({ locale, namespace: 'session' });
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const format = await getFormatter({ locale });

  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, kind, played_on, result, sets, venue_id, venue_freetext, notes')
    .order('played_on', { ascending: false })
    .limit(50);

  /**
   * Los clubes de la lista, en una sola consulta aparte. No como join: los
   * tipos generados no declaran relaciones, y un select anidado perdería el
   * tipado. Si el club dejó de ser visible (lo rechazó un moderador), se cae
   * al texto libre, y si no hay, no se muestra lugar.
   */
  const venueIds = [
    ...new Set((sessions ?? []).map((s) => s.venue_id).filter((id): id is string => Boolean(id))),
  ];
  const { data: venues } = venueIds.length
    ? await supabase.from('venues').select('id, name, city').in('id', venueIds)
    : { data: [] };
  const venueById = new Map((venues ?? []).map((v) => [v.id, v]));

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl">{tNav('sessions')}</h1>
        <Link
          href="/sesiones/nueva"
          className="touch-target grid place-items-center rounded-pill bg-accent px-5 font-semibold text-accent-ink"
        >
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
                <div>
                  <p className="text-sm text-fg-secondary">
                    {format.dateTime(new Date(session.played_on), {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  <VenueLink
                    venue={
                      (session.venue_id ? venueById.get(session.venue_id) : undefined) ??
                      (session.venue_freetext ? { name: session.venue_freetext, city: null } : null)
                    }
                    label={t('openInMaps')}
                  />
                </div>

                {/* El color nunca es el único portador: va con texto (§10). */}
                {session.result ? (
                  <span
                    className={
                      session.result === 'win'
                        ? 'rounded-pill bg-win/15 px-3 py-1 text-xs font-semibold text-win'
                        : session.result === 'loss'
                          ? 'rounded-pill bg-loss/15 px-3 py-1 text-xs font-semibold text-loss'
                          : 'rounded-pill bg-bg-elevated px-3 py-1 text-xs font-semibold text-fg-secondary'
                    }
                  >
                    {t(`result.${session.result}` as 'result.win')}
                  </span>
                ) : (
                  <span className="rounded-pill bg-bg-elevated px-3 py-1 text-xs font-semibold text-fg-secondary">
                    {t('kind.training')}
                  </span>
                )}
              </div>

              {session.sets ? (
                <div className="mt-4">
                  <Scoreboard sets={session.sets as unknown as SetScore[]} />
                </div>
              ) : null}

              {session.notes ? (
                <p className="mt-2 text-sm text-fg-secondary">{session.notes}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-12 rounded-card border border-border bg-bg-surface p-10 text-center">
          <p className="text-fg-secondary">{t('empty')}</p>
          <Link
            href="/sesiones/nueva"
            className="touch-target mt-6 inline-grid place-items-center rounded-pill bg-accent px-6 font-semibold text-accent-ink"
          >
            {tNav('addSession')}
          </Link>
        </div>
      )}
    </main>
  );
}

/**
 * El lugar del partido, como enlace a Google Maps.
 *
 * Nueva pestaña para no sacarte de tu historial. `noreferrer` para que Google
 * no reciba desde qué página de la app llegaste.
 */
function VenueLink({
  venue,
  label,
}: {
  venue: { name: string; city: string | null } | null;
  label: string;
}) {
  if (!venue) return null;
  // Nombre y ciudad, no coordenadas: con coordenadas Google muestra un pin
  // suelto; con el nombre abre la ficha del club, que es "el lugar real".
  const text = venue.city ? `${venue.name}, ${venue.city}` : venue.name;
  const href = mapsSearchUrl(text);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${text} · ${label}`}
      className="mt-0.5 inline-flex items-center gap-1 text-xs text-fg-secondary underline decoration-border underline-offset-4 hover:text-fg hover:decoration-fg-secondary"
    >
      <span aria-hidden="true">📍</span>
      {text}
    </a>
  );
}
