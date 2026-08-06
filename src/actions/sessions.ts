'use server';

import { revalidatePath } from 'next/cache';

import { getUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { resultFromSets } from '@/lib/sessions/score';
import { sessionSchema } from '@/lib/validation/session';

/**
 * Alta de una sesión · §05.
 *
 * Patrón obligatorio del §8.3: sesión → Zod → autorización → efecto.
 * El rate limit y la auditoría entran en los bloques 10 y 14.
 */

export type SessionResult =
  | { ok: true; sessionId: string }
  | {
      ok: false;
      error:
        | 'not_authenticated'
        | 'no_profile'
        | 'invalid_input'
        | 'future_date'
        | 'invalid_score'
        | 'unavailable';
    };

export async function createSession(input: unknown): Promise<SessionResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: 'not_authenticated' };

  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const data = parsed.data;
  const supabase = await createClient();

  /**
   * Un partido futuro no es un partido jugado. Se compara contra mañana y no
   * contra hoy porque el servidor está en UTC y el jugador puede estar hasta
   * un día "adelantado": rechazar por eso sería un error del sistema, no del
   * usuario.
   */
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  if (data.playedOn > tomorrow) return { ok: false, error: 'future_date' };

  /**
   * El resultado se DERIVA de los sets, no llega del cliente. Es lo que impide
   * cargar "gané" con un 3-6 3-6 y ensuciar las estadísticas.
   */
  let result: 'win' | 'loss' | 'draw' | null = null;

  if (data.kind === 'match') {
    result = resultFromSets(data.sets);
    if (result === null) return { ok: false, error: 'invalid_score' };
  } else if (data.kind === 'quick_match') {
    result = data.result;
  }

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      owner_id: user.id,
      kind: data.kind,
      played_on: data.playedOn,
      result,
      sets: data.kind === 'match' ? data.sets : null,
      venue_id: data.venueId ?? null,
      venue_freetext: data.venueFreetext ?? null,
      notes: data.notes ?? null,
      self_rating: data.selfRating ?? null,
      side_played: data.sidePlayed ?? null,
      // `opponents_avg_level` lo calcula el servidor abajo, no el cliente.
    })
    .select('id')
    .single();

  if (error || !session) {
    // 23503 = clave foránea rota, típicamente un perfil que no existe todavía.
    if (error?.code === '23503') return { ok: false, error: 'no_profile' };
    return { ok: false, error: 'unavailable' };
  }

  if (data.participants.length > 0) {
    const { error: participantsError } = await supabase
      .from('session_participants')
      .insert(
        data.participants.map((p) => ({
          session_id: session.id,
          profile_id: p.profileId ?? null,
          guest_name: p.guestName ?? null,
          team: p.team,
          perceived_level: p.perceivedLevel ?? null,
          // El dueño de la sesión queda confirmado de entrada: es quien la
          // está cargando. Los demás tienen que confirmar (§05).
        })),
      );

    if (participantsError) {
      // La sesión ya existe pero quedó sin participantes. Se borra entera en
      // vez de dejar un registro a medias que después nadie entiende.
      await supabase.from('sessions').delete().eq('id', session.id);
      return { ok: false, error: 'unavailable' };
    }

    // Promedio del nivel que el dueño asignó a los rivales. Calculado acá, no
    // ingresado: es un dato derivado y no debería poder contradecirse.
    const opponentLevels = data.participants
      .filter((p) => p.team === 'opponent' && p.perceivedLevel !== undefined)
      .map((p) => p.perceivedLevel as number);

    if (opponentLevels.length > 0) {
      const avg =
        Math.round(
          (opponentLevels.reduce((a, b) => a + b, 0) / opponentLevels.length) * 10,
        ) / 10;

      await supabase
        .from('sessions')
        .update({ opponents_avg_level: avg })
        .eq('id', session.id);
    }
  }

  revalidatePath('/sesiones');
  revalidatePath('/panel');

  return { ok: true, sessionId: session.id };
}

/**
 * Confirmar o rechazar que te etiquetaron en un partido ajeno.
 *
 * Hasta que se confirma, esa sesión no cuenta en tus estadísticas ni habilita
 * a valorar niveles. Es lo que impide que alguien escriba en tu historial.
 */
export async function respondToTag(
  sessionId: unknown,
  accept: unknown,
): Promise<{ ok: boolean }> {
  const user = await getUser();
  if (!user) return { ok: false };

  if (typeof sessionId !== 'string' || typeof accept !== 'boolean') {
    return { ok: false };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('session_participants')
    .update(
      accept
        ? { confirmed_at: now, rejected_at: null }
        : { rejected_at: now, confirmed_at: null },
    )
    .eq('session_id', sessionId)
    .eq('profile_id', user.id);

  if (error) return { ok: false };

  revalidatePath('/sesiones');
  revalidatePath('/panel');
  return { ok: true };
}

export async function deleteSession(sessionId: unknown): Promise<{ ok: boolean }> {
  const user = await getUser();
  if (!user || typeof sessionId !== 'string') return { ok: false };

  const supabase = await createClient();

  // La política de RLS ya limita el borrado al dueño; el `eq` es explícito
  // para que la intención se lea en el código y no solo en la base.
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId)
    .eq('owner_id', user.id);

  if (error) return { ok: false };

  revalidatePath('/sesiones');
  revalidatePath('/panel');
  return { ok: true };
}
