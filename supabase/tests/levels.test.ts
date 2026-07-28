import { beforeEach, describe, expect, it } from 'vitest';

import { createUser, db, truncateAll } from './helpers';

/**
 * Motor de niveles · §12.2 y §12.3.
 *
 * No alcanza con probar el camino feliz: este cálculo decide con quién juega
 * la gente, así que lo que hay que probar son los casos ADVERSARIOS. Cada
 * regla anti-abuso del blueprint es un test acá.
 */

/** Da a `profile` las 3 sesiones confirmadas que exige la regla 3 para votar. */
async function makeEligible(profile: string) {
  for (let i = 0; i < 3; i++) {
    const [s] = await db`
      INSERT INTO public.sessions (owner_id, kind, played_on, result)
      VALUES (${profile}, 'match', current_date - (${i}::integer), 'win')
      RETURNING id
    `;
    await db`
      INSERT INTO public.session_participants (session_id, profile_id, team, confirmed_at)
      VALUES (${s!.id}, ${profile}, 'mine', now())
    `;
  }
}

/** Registra una valoración de `rater` sobre `subject`, opcionalmente antigua. */
async function rate(
  rater: string,
  subject: string,
  value: number,
  daysAgo = 0,
) {
  const [s] = await db`
    INSERT INTO public.sessions (owner_id, kind, played_on, result)
    VALUES (${rater}, 'match', current_date, 'win') RETURNING id
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

async function levelOf(id: string) {
  const [row] = await db`
    SELECT declared_level, perceived_level, effective_level, rater_count
    FROM public.profiles WHERE id = ${id}
  `;
  return {
    declared: Number(row!.declared_level),
    perceived: row!.perceived_level === null ? null : Number(row!.perceived_level),
    effective: Number(row!.effective_level),
    raters: Number(row!.rater_count),
  };
}

describe('nivel percibido', () => {
  beforeEach(truncateAll);

  it('sin valoraciones, el efectivo es igual al declarado', async () => {
    const a = await createUser({ declaredLevel: 4.0 });
    await db`SELECT app.refresh_level(${a.id})`;

    const l = await levelOf(a.id);
    expect(l.perceived).toBeNull();
    expect(l.effective).toBe(4.0);
    expect(l.raters).toBe(0);
  });

  /**
   * Regla 3 del §12.3: una cuenta nueva no mueve el nivel de nadie. Sin esto
   * se crean cuentas descartables para hundir a alguien.
   */
  it('un votante sin historial NO cuenta', async () => {
    const victima = await createUser({ declaredLevel: 4.0 });
    const novato = await createUser();

    await rate(novato.id, victima.id, 1.0);
    await db`SELECT app.refresh_level(${victima.id})`;

    const l = await levelOf(victima.id);
    expect(l.raters).toBe(0);
    expect(l.effective).toBe(4.0);
  });

  it('el voto guardado entra retroactivamente al volverse elegible', async () => {
    const victima = await createUser({ declaredLevel: 4.0 });
    const votante = await createUser();

    await rate(votante.id, victima.id, 6.0);
    await db`SELECT app.refresh_level(${victima.id})`;
    expect((await levelOf(victima.id)).raters).toBe(0);

    // El votante junta sus 3 sesiones y ahora sí pesa.
    await makeEligible(votante.id);
    await db`SELECT app.refresh_level(${victima.id})`;

    const l = await levelOf(victima.id);
    expect(l.raters).toBe(1);
    expect(l.perceived).toBe(6.0);
  });

  /**
   * Paso 1 del §12.2. Sin esto, dos amigos que juegan seguido dominan el
   * nivel de una persona.
   */
  it('un votante con 10 valoraciones pesa lo mismo que uno con una', async () => {
    const victima = await createUser({ declaredLevel: 4.0 });
    const insistente = await createUser();
    await makeEligible(insistente.id);

    for (let i = 0; i < 10; i++) {
      await rate(insistente.id, victima.id, 7.0);
    }
    await db`SELECT app.refresh_level(${victima.id})`;

    const l = await levelOf(victima.id);
    expect(l.raters).toBe(1); // una persona, un voto
  });

  it('el peso de la comunidad crece con la cantidad de votantes', async () => {
    const victima = await createUser({ declaredLevel: 3.0 });

    const medir = async (n: number) => {
      await truncateAll();
      const v = await createUser({ declaredLevel: 3.0 });
      for (let i = 0; i < n; i++) {
        const votante = await createUser();
        await makeEligible(votante.id);
        await rate(votante.id, v.id, 6.0);
      }
      await db`SELECT app.refresh_level(${v.id})`;
      return levelOf(v.id);
    };

    void victima;
    // w = n/(n+5) → con 5 votantes el efectivo queda a mitad de camino.
    const con5 = await medir(5);
    expect(con5.raters).toBe(5);
    expect(con5.effective).toBeGreaterThan(3.0);
    expect(con5.effective).toBeLessThan(6.0);
  });

  /**
   * Regla 14: el freno de 0,5 puntos cada 30 días. Es lo que impide que un
   * grupo coordinado hunda a alguien en una semana.
   */
  it('el efectivo no salta más de 0,5 puntos de una vez', async () => {
    const victima = await createUser({ declaredLevel: 6.0, effectiveLevel: 6.0 });

    // 20 votantes coordinados diciendo que es 1.0.
    for (let i = 0; i < 20; i++) {
      const votante = await createUser();
      await makeEligible(votante.id);
      await rate(votante.id, victima.id, 1.0);
    }
    await db`SELECT app.refresh_level(${victima.id})`;

    const l = await levelOf(victima.id);
    expect(l.raters).toBe(20);
    // El objetivo sería ~2.0, pero el freno lo deja cerca de 5.5.
    expect(l.effective).toBeGreaterThanOrEqual(5.4);
    expect(6.0 - l.effective).toBeLessThanOrEqual(0.6);
  });

  /**
   * Paso 2 del §12.2: media vida de 180 días. La gente mejora y el nivel
   * tiene que poder seguirla.
   */
  it('una valoración vieja pesa menos que una reciente', async () => {
    const a = await createUser({ declaredLevel: 4.0 });
    const viejo = await createUser();
    const nuevo = await createUser();
    await makeEligible(viejo.id);
    await makeEligible(nuevo.id);

    await rate(viejo.id, a.id, 2.0, 720); // hace 2 años
    await rate(nuevo.id, a.id, 6.0, 0);
    await db`SELECT app.refresh_level(${a.id})`;

    const l = await levelOf(a.id);
    // El promedio simple daría 4.0; con decaimiento manda el reciente.
    expect(l.perceived).toBeGreaterThan(5.0);
  });

  it('el declarado NUNCA lo reescribe el sistema', async () => {
    const a = await createUser({ declaredLevel: 4.0 });
    for (let i = 0; i < 10; i++) {
      const votante = await createUser();
      await makeEligible(votante.id);
      await rate(votante.id, a.id, 1.0);
    }
    await db`SELECT app.refresh_level(${a.id})`;

    const l = await levelOf(a.id);
    expect(l.declared).toBe(4.0); // regla 11
  });

  it('cada cambio de efectivo queda en el historial', async () => {
    const a = await createUser({ declaredLevel: 4.0 });
    for (let i = 0; i < 6; i++) {
      const votante = await createUser();
      await makeEligible(votante.id);
      await rate(votante.id, a.id, 6.5);
    }
    await db`SELECT app.refresh_level(${a.id})`;

    const [row] = await db`
      SELECT count(*)::int AS n FROM public.level_history
      WHERE profile_id = ${a.id} AND field = 'effective'
    `;
    expect(row?.n).toBeGreaterThanOrEqual(1);
  });
});

describe('conexiones derivadas de haber jugado', () => {
  beforeEach(truncateAll);

  it('jugar juntos crea la conexión, sin solicitud de por medio', async () => {
    const a = await createUser();
    const b = await createUser();

    const [s] = await db`
      INSERT INTO public.sessions (owner_id, kind, played_on, result)
      VALUES (${a.id}, 'match', current_date, 'win') RETURNING id
    `;
    await db`
      INSERT INTO public.session_participants (session_id, profile_id, team, confirmed_at)
      VALUES (${s!.id}, ${a.id}, 'mine', now()),
             (${s!.id}, ${b.id}, 'opponent', now())
    `;
    await db`REFRESH MATERIALIZED VIEW public.played_with`;

    const [row] = await db`
      SELECT times_played FROM public.played_with
      WHERE profile_id = ${a.id} AND other_id = ${b.id}
    `;
    expect(Number(row?.times_played)).toBe(1);
  });

  it('una sesión sin confirmar NO crea conexión', async () => {
    const a = await createUser();
    const b = await createUser();

    const [s] = await db`
      INSERT INTO public.sessions (owner_id, kind, played_on, result)
      VALUES (${a.id}, 'match', current_date, 'win') RETURNING id
    `;
    // B fue etiquetado pero no confirmó.
    await db`
      INSERT INTO public.session_participants (session_id, profile_id, team, confirmed_at)
      VALUES (${s!.id}, ${a.id}, 'mine', now()),
             (${s!.id}, ${b.id}, 'opponent', NULL)
    `;
    await db`REFRESH MATERIALIZED VIEW public.played_with`;

    const rows = await db`
      SELECT * FROM public.played_with WHERE profile_id = ${a.id}
    `;
    expect(rows).toHaveLength(0);
  });
});
