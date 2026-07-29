import { beforeEach, describe, expect, it } from 'vitest';

import { createUser, db, truncateAll } from './helpers';

/**
 * Confianza del nivel · adaptado de Glicko-2 y del MMR de alta incertidumbre.
 *
 * Lo que se prueba acá no es que el cálculo dé un número, sino que la
 * VELOCIDAD del ajuste dependa de cuánto sabemos: rápido con un jugador nuevo,
 * lento con uno establecido. Es lo que separa "corregir a quien declaró mal"
 * de "dejar que le bajen el nivel a alguien".
 */

async function makeEligible(profile: string, daysAgo = 0) {
  for (let i = 0; i < 3; i++) {
    const [s] = await db`
      INSERT INTO public.sessions (owner_id, kind, played_on, result)
      VALUES (${profile}, 'match',
              current_date - (${daysAgo + i}::integer), 'win')
      RETURNING id
    `;
    await db`
      INSERT INTO public.session_participants (session_id, profile_id, team, confirmed_at)
      VALUES (${s!.id}, ${profile}, 'mine', now())
    `;
  }
}

async function rate(
  rater: string,
  subject: string,
  value: number,
  daysAgo = 0,
) {
  const [s] = await db`
    INSERT INTO public.sessions (owner_id, kind, played_on, result)
    VALUES (${rater}, 'match', current_date - (${daysAgo}::integer), 'win')
    RETURNING id
  `;
  await db`
    INSERT INTO public.session_participants (session_id, profile_id, team, confirmed_at)
    VALUES (${s!.id}, ${rater}, 'mine', now()),
           (${s!.id}, ${subject}, 'opponent', now())
  `;
  await db`
    INSERT INTO public.level_ratings (session_id, rater_id, subject_id, value, created_at)
    VALUES (${s!.id}, ${rater}, ${subject}, ${value},
            now() - (${daysAgo} || ' days')::interval)
  `;
}

async function confidenceOf(id: string) {
  const [row] = await db`
    SELECT level_confidence FROM public.profiles WHERE id = ${id}
  `;
  return Number(row!.level_confidence);
}

describe('confianza del nivel', () => {
  beforeEach(truncateAll);

  it('un jugador sin partidos tiene confianza cero', async () => {
    const a = await createUser();
    await db`SELECT app.refresh_level(${a.id})`;
    expect(await confidenceOf(a.id)).toBe(0);
  });

  it('la confianza crece con la cantidad de votantes distintos', async () => {
    const medir = async (n: number) => {
      await truncateAll();
      const subject = await createUser({ effectiveLevel: 4.0 });
      for (let i = 0; i < n; i++) {
        const votante = await createUser();
        await makeEligible(votante.id);
        await rate(votante.id, subject.id, 4.5);
      }
      await db`SELECT app.refresh_level(${subject.id})`;
      return confidenceOf(subject.id);
    };

    const con2 = await medir(2);
    const con10 = await medir(10);

    expect(con2).toBeGreaterThan(0);
    expect(con10).toBeGreaterThan(con2);
    // Nunca llega a 1: siempre queda margen a seguir aprendiendo, como la RD.
    expect(con10).toBeLessThan(1);
  });

  /**
   * El caso que motivó todo esto. La gente cambia de nivel cuando deja de
   * jugar, así que lo honesto es admitir que ya no sabemos.
   */
  it('la confianza decae con la inactividad', async () => {
    const activo = await createUser({ effectiveLevel: 4.0 });
    const inactivo = await createUser({ effectiveLevel: 4.0 });

    for (const [subject, daysAgo] of [
      [activo.id, 0],
      [inactivo.id, 500],
    ] as const) {
      for (let i = 0; i < 5; i++) {
        const votante = await createUser();
        await makeEligible(votante.id);
        await rate(votante.id, subject, 4.5, daysAgo);
      }
      await db`SELECT app.refresh_level(${subject})`;
    }

    expect(await confidenceOf(activo.id)).toBeGreaterThan(
      await confidenceOf(inactivo.id),
    );
  });
});

describe('freno adaptativo', () => {
  beforeEach(truncateAll);

  it('con poca confianza el nivel se mueve rápido', async () => {
    expect(Number((await db`SELECT app.max_step_for_confidence(0)`)[0]!.max_step_for_confidence))
      .toBe(1.5);
  });

  it('con mucha confianza el nivel se mueve lento', async () => {
    expect(Number((await db`SELECT app.max_step_for_confidence(1)`)[0]!.max_step_for_confidence))
      .toBe(0.3);
  });

  /**
   * El problema concreto del freno fijo: alguien que declaró 3.0 siendo 5.0
   * tardaba cuatro meses en llegar a su nivel, jugando partidos desparejos
   * todo ese tiempo. Con confianza baja converge en la primera tanda.
   */
  it('un jugador nuevo mal declarado converge rápido', async () => {
    const novato = await createUser({ declaredLevel: 3.0, effectiveLevel: 3.0 });

    for (let i = 0; i < 6; i++) {
      const votante = await createUser();
      await makeEligible(votante.id);
      await rate(votante.id, novato.id, 5.0);
    }
    await db`SELECT app.refresh_level(${novato.id})`;

    const [row] = await db`
      SELECT effective_level FROM public.profiles WHERE id = ${novato.id}
    `;
    // Con el freno fijo de 0.5 se habría quedado en 3.5.
    expect(Number(row!.effective_level)).toBeGreaterThan(3.6);
  });

  /**
   * Y el contrario: alguien conocido no se mueve fácil, que es lo que protege
   * de que un grupo le baje la categoría a propósito.
   */
  it('un jugador establecido resiste el empuje', async () => {
    const veterano = await createUser({ declaredLevel: 5.0, effectiveLevel: 5.0 });

    // Primero se gana confianza con votos que confirman su nivel.
    for (let i = 0; i < 15; i++) {
      const votante = await createUser();
      await makeEligible(votante.id);
      await rate(votante.id, veterano.id, 5.0);
    }
    await db`SELECT app.refresh_level(${veterano.id})`;

    const confianza = await confidenceOf(veterano.id);
    expect(confianza).toBeGreaterThan(0.4);

    const [row] = await db`
      SELECT app.max_step_for_confidence(${confianza}) AS step
    `;
    // Mucho más lento que el 1.5 de un jugador nuevo.
    expect(Number(row!.step)).toBeLessThan(1.0);
  });
});

describe('peso del votante según su propia confianza', () => {
  beforeEach(truncateAll);

  it('nadie pesa menos que el piso: jugó el partido y vio algo', async () => {
    const novato = await createUser();
    const [row] = await db`SELECT app.rater_weight(${novato.id}) AS w`;
    expect(Number(row!.w)).toBe(0.4);
  });

  /**
   * De Glicko: un rival cuya fuerza real no se conoce aporta poca información.
   * Efecto lateral: una red de cuentas nuevas coordinadas pesa poco sin que
   * haga falta detectarla como fraude.
   */
  it('un votante establecido pesa más que uno nuevo', async () => {
    const establecido = await createUser({ effectiveLevel: 4.0 });
    for (let i = 0; i < 12; i++) {
      const otro = await createUser();
      await makeEligible(otro.id);
      await rate(otro.id, establecido.id, 4.0);
    }
    await db`SELECT app.refresh_level(${establecido.id})`;

    const novato = await createUser();

    const [pesoEstablecido] = await db`SELECT app.rater_weight(${establecido.id}) AS w`;
    const [pesoNovato] = await db`SELECT app.rater_weight(${novato.id}) AS w`;

    expect(Number(pesoEstablecido!.w)).toBeGreaterThan(Number(pesoNovato!.w));
  });
});
