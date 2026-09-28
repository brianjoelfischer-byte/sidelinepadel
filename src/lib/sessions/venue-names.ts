import 'server-only';

import type { createClient } from '@/lib/supabase/server';

type Client = Awaited<ReturnType<typeof createClient>>;

export interface VenueLabel {
  name: string;
  city: string | null;
}

/**
 * Nombre y ciudad de los clubes de una lista de sesiones, en una sola
 * consulta.
 *
 * No como join: los tipos generados no declaran relaciones, y un select
 * anidado perdería el tipado. Si un club dejó de ser visible (lo rechazó un
 * moderador), no aparece en el mapa y quien llama cae al texto libre.
 */
export async function loadVenueLabels(
  supabase: Client,
  venueIds: (string | null)[],
): Promise<Map<string, VenueLabel>> {
  const ids = [...new Set(venueIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();

  const { data } = await supabase.from('venues').select('id, name, city').in('id', ids);
  return new Map((data ?? []).map((v) => [v.id, { name: v.name, city: v.city }]));
}

/** El club elegido de la lista, o el texto que se escribió a mano. */
export function venueFor(
  session: { venue_id: string | null; venue_freetext: string | null },
  labels: Map<string, VenueLabel>,
): VenueLabel | null {
  const chosen = session.venue_id ? labels.get(session.venue_id) : undefined;
  if (chosen) return chosen;
  return session.venue_freetext ? { name: session.venue_freetext, city: null } : null;
}
