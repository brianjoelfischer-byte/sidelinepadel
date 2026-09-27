import { beforeEach, describe, expect, it } from 'vitest';

import { createUser, db, expectRejected, truncateAll } from './helpers';

/**
 * Límite de desvío en las valoraciones · §12.3.
 *
 * Los frenos anteriores (media recortada, decaimiento, mínimo de votantes)
 * actúan DESPUÉS de recibir el voto. Este actúa antes: una valoración absurda
 * no entra a la base, así que nunca llega a promediarse.
 */

/** Sesión confirmada entre dos personas, que es lo que habilita a valorar. */
async function playedTogether(a: string, b: string) {
  const [s] = await db`
    INSERT INTO public.sessions (owner_id, kind, played_on, result)
    VALUES (${a}, 'match', current_date, 'win') RETURNING id
  `;
  const sid = s!.id as string;
  await db`
    INSERT INTO public.session_participants (session_id, profile_id, team, confirmed_at)
    VALUES (${sid}, ${a}, 'mine', now()),
           (${sid}, ${b}, 'opponent', now())
  `;
  return sid;
}

function rate(sid: string, rater: string, subject: string, value: number) {
  return db`
    INSERT INTO public.level_ratings (session_id, rater_id, subject_id, value)
    VALUES (${sid}, ${rater}, ${subject}, ${value})
  `;
}

describe('límite de ±2.5 en las valoraciones', () => {
  beforeEach(truncateAll);

  it('acepta una valoración dentro del rango', async () => {
    const rater = await createUser();
    const subject = await createUser({ effectiveLevel: 4.0 });
    const sid = await playedTogether(rater.id, subject.id);

    await rate(sid, rater.id, subject.id, 5.5);

    const [row] = await db`SELECT count(*)::int AS n FROM public.level_ratings`;
    expect(row?.n).toBe(1);
  });

  it('acepta los bordes exactos', async () => {
    const subject = await createUser({ effectiveLevel: 4.0 });

    for (const value of [1.5, 6.5]) {
      const rater = await createUser();
      const sid = await playedTogether(rater.id, subject.id);
      await rate(sid, rater.id, subject.id, value);
    }

    const [row] = await db`SELECT count(*)::int AS n FROM public.level_ratings`;
    expect(row?.n).toBe(2);
  });

  /** El caso que motivó la regla: el amigo que pone 1.0 de chiste. */
  it('RECHAZA un voto absurdamente bajo', async () => {
    const rater = await createUser();
    const subject = await createUser({ effectiveLevel: 4.0 });
    const sid = await playedTogether(rater.id, subject.id);

    const message = await expectRejected(rate(sid, rater.id, subject.id, 1.0));
    expect(message).toMatch(/fuera de rango/i);
  });

  it('RECHAZA un voto absurdamente alto', async () => {
    const rater = await createUser();
    const subject = await createUser({ effectiveLevel: 4.0 });
    const sid = await playedTogether(rater.id, subject.id);

    await expectRejected(rate(sid, rater.id, subject.id, 7.0));
  });

  it('el rango se recorta contra los extremos de la escala', async () => {
    // Alguien en 1.0 no puede recibir menos de 1.0: no existe.
    const subject = await createUser({ effectiveLevel: 1.0 });
    const [bounds] = await db`
      SELECT * FROM public.rating_bounds_for(${subject.id})
    `;
    expect(Number(bounds?.min_value)).toBe(1.0);
    expect(Number(bounds?.max_value)).toBe(3.5);

    const top = await createUser({ effectiveLevel: 7.0 });
    const [topBounds] = await db`
      SELECT * FROM public.rating_bounds_for(${top.id})
    `;
    expect(Number(topBounds?.min_value)).toBe(4.5);
    expect(Number(topBounds?.max_value)).toBe(7.0);
  });

  it('guarda el nivel de referencia para poder auditar después', async () => {
    const rater = await createUser();
    const subject = await createUser({ effectiveLevel: 4.0 });
    const sid = await playedTogether(rater.id, subject.id);

    await rate(sid, rater.id, subject.id, 5.0);

    const [row] = await db`
      SELECT subject_level_at_rating FROM public.level_ratings
    `;
    expect(Number(row?.subject_level_at_rating)).toBe(4.0);
  });

  /**
   * La ventana se mueve con el nivel: una categoría mal declarada igual se
   * corrige, solo que despacio. Sin esto el límite sería un techo permanente.
   */
  it('la ventana acompaña al nivel efectivo cuando cambia', async () => {
    const subject = await createUser({ effectiveLevel: 6.0 });

    const [before] = await db`SELECT * FROM public.rating_bounds_for(${subject.id})`;
    expect(Number(before?.min_value)).toBe(3.5);

    await db`
      UPDATE public.profiles SET effective_level = 5.0 WHERE id = ${subject.id}
    `;

    const [after] = await db`SELECT * FROM public.rating_bounds_for(${subject.id})`;
    expect(Number(after?.min_value)).toBe(2.5);
  });

  it('también se aplica al editar una valoración existente', async () => {
    const rater = await createUser();
    const subject = await createUser({ effectiveLevel: 4.0 });
    const sid = await playedTogether(rater.id, subject.id);

    await rate(sid, rater.id, subject.id, 5.0);

    await expectRejected(
      db`
        UPDATE public.level_ratings SET value = 1.0
        WHERE rater_id = ${rater.id} AND subject_id = ${subject.id}
      `,
    );
  });
});
