'use server';

import { randomInt } from 'node:crypto';

import { getUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { onboardingSchema, slugify } from '@/lib/validation/profile';

/**
 * Alta del perfil al terminar el onboarding.
 *
 * Sigue el patrón obligatorio del §8.3: sesión → Zod → autorización → efecto.
 * El rate limit y la auditoría entran en los bloques 10 y 14; están anotados
 * abajo para que no se pierdan.
 */

export type OnboardingResult =
  | { ok: true; slug: string }
  | {
      ok: false;
      error:
        | 'not_authenticated'
        | 'invalid_input'
        | 'under_minimum_age'
        | 'already_exists'
        | 'unavailable';
      field?: string;
    };

/** Busca un slug libre. Ante colisión agrega sufijo aleatorio, no correlativo. */
async function findFreeSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string,
): Promise<string> {
  const candidate = base || 'jugador';

  const { data } = await supabase
    .from('profiles')
    .select('slug')
    .eq('slug', candidate)
    .maybeSingle();

  if (!data) return candidate;

  // Aleatorio y no `-2`, `-3`: un correlativo deja adivinar cuántas personas
  // con ese nombre hay registradas.
  for (let attempt = 0; attempt < 8; attempt++) {
    const suffix = randomInt(1000, 9999);
    const next = `${candidate.slice(0, 27)}-${suffix}`;

    const { data: taken } = await supabase
      .from('profiles')
      .select('slug')
      .eq('slug', next)
      .maybeSingle();

    if (!taken) return next;
  }

  throw new Error('no se pudo generar un slug libre');
}

export async function completeOnboarding(
  input: unknown,
): Promise<OnboardingResult> {
  // 1 · Sesión
  const user = await getUser();
  if (!user) return { ok: false, error: 'not_authenticated' };

  // 2 · Forma de la entrada. La verificación de edad vive en el esquema, así
  //     que un menor de 16 no pasa de acá (§02).
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.message === 'under_minimum_age') {
      return { ok: false, error: 'under_minimum_age', field: 'birthDate' };
    }
    return {
      ok: false,
      error: 'invalid_input',
      ...(issue?.path[0] !== undefined ? { field: String(issue.path[0]) } : {}),
    };
  }

  const data = parsed.data;
  const supabase = await createClient();

  // 3 · El onboarding se completa una sola vez.
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (existing) return { ok: false, error: 'already_exists' };

  // 4 · Efecto. El nivel efectivo arranca igual al declarado: todavía no hay
  //     valoraciones de nadie, así que la comunidad pesa cero (§12.2).
  const slug = await findFreeSlug(supabase, slugify(data.displayName));

  const { error } = await supabase.from('profiles').insert({
    id: user.id,
    display_name: data.displayName,
    slug,
    country_code: data.countryCode,
    locale: data.locale,
    timezone: data.timezone,
    declared_level: data.declaredLevel,
    effective_level: data.declaredLevel,
    preferred_hand: data.preferredHand,
    preferred_side: data.preferredSide,
    racket: data.racket ?? null,
    birth_date: data.birthDate,
    is_public: data.isPublic,
    // `role` no se manda: la política de RLS solo acepta 'player' en el INSERT,
    // y el default de la tabla ya lo pone. Mandarlo sería darle al cliente una
    // palanca que no necesita.
  });

  if (error) {
    // 23505 = violación de unicidad. Puede ser una carrera entre dos pestañas.
    if (error.code === '23505') return { ok: false, error: 'already_exists' };
    return { ok: false, error: 'unavailable' };
  }

  // TODO bloque 14 · rate limit por usuario
  // TODO bloque 13 · audit_log de 'profile.create'

  return { ok: true, slug };
}
