import { beforeEach, describe, expect, it } from 'vitest';

import { asUser, createUser, db, expectRejected, truncateAll } from './helpers';

/** Crea una sesión de `owner` etiquetando a `tagged`, sin confirmar todavía. */
async function seedSession(owner: string, tagged: string) {
  const [session] = await db`
    INSERT INTO public.sessions (owner_id, kind, played_on, result)
    VALUES (${owner}, 'match', current_date, 'win')
    RETURNING id
  `;
  const sessionId = session!.id as string;

  await db`
    INSERT INTO public.session_participants (session_id, profile_id, team)
    VALUES (${sessionId}, ${tagged}, 'opponent')
  `;
  return sessionId;
}

describe('RLS · sesiones', () => {
  beforeEach(truncateAll);

  it('el dueño ve su sesión', async () => {
    const a = await createUser();
    const b = await createUser();
    const sid = await seedSession(a.id, b.id);

    const rows = await asUser(a.id, (sql) =>
      sql`SELECT id FROM public.sessions WHERE id = ${sid}`,
    );
    expect(rows).toHaveLength(1);
  });

  it('un tercero NO ve la sesión', async () => {
    const a = await createUser();
    const b = await createUser();
    const c = await createUser();
    const sid = await seedSession(a.id, b.id);

    const rows = await asUser(c.id, (sql) =>
      sql`SELECT id FROM public.sessions WHERE id = ${sid}`,
    );
    expect(rows).toHaveLength(0);
  });

  /**
   * El corazón del §05: lo que A escribe sobre B no entra al historial de B
   * hasta que B lo confirme. Sin esto cualquiera podría inflar o ensuciar
   * las estadísticas ajenas.
   */
  it('el etiquetado NO ve la sesión hasta confirmarla', async () => {
    const a = await createUser();
    const b = await createUser();
    const sid = await seedSession(a.id, b.id);

    const antes = await asUser(b.id, (sql) =>
      sql`SELECT id FROM public.sessions WHERE id = ${sid}`,
    );
    expect(antes).toHaveLength(0);

    // Pero SÍ ve que lo etiquetaron — si no, no podría decidir.
    const etiqueta = await asUser(b.id, (sql) =>
      sql`SELECT id FROM public.session_participants WHERE session_id = ${sid}`,
    );
    expect(etiqueta).toHaveLength(1);
  });

  it('el etiquetado ve la sesión después de confirmar', async () => {
    const a = await createUser();
    const b = await createUser();
    const sid = await seedSession(a.id, b.id);

    await asUser(b.id, (sql) =>
      sql`
        UPDATE public.session_participants SET confirmed_at = now()
        WHERE session_id = ${sid} AND profile_id = ${b.id}
      `,
    );

    const rows = await asUser(b.id, (sql) =>
      sql`SELECT id FROM public.sessions WHERE id = ${sid}`,
    );
    expect(rows).toHaveLength(1);
  });

  it('el etiquetado NO puede editar el resultado del partido', async () => {
    const a = await createUser();
    const b = await createUser();
    const sid = await seedSession(a.id, b.id);

    await asUser(b.id, (sql) =>
      sql`UPDATE public.sessions SET result = 'loss' WHERE id = ${sid}`,
    );

    const [row] = await db`SELECT result FROM public.sessions WHERE id = ${sid}`;
    expect(row?.result).toBe('win');
  });

  it('NO se puede registrar una sesión a nombre de otro', async () => {
    const a = await createUser();
    const b = await createUser();

    await expectRejected(
      asUser(a.id, (sql) =>
        sql`
          INSERT INTO public.sessions (owner_id, kind, played_on, result)
          VALUES (${b.id}, 'match', current_date, 'win')
        `,
      ),
    );
  });

  it('NO se puede etiquetar gente en la sesión de otro', async () => {
    const a = await createUser();
    const b = await createUser();
    const c = await createUser();
    const sid = await seedSession(a.id, b.id);

    await expectRejected(
      asUser(c.id, (sql) =>
        sql`
          INSERT INTO public.session_participants (session_id, profile_id, team)
          VALUES (${sid}, ${c.id}, 'mine')
        `,
      ),
    );
  });

  it('un entrenamiento no puede tener resultado', async () => {
    const a = await createUser();
    await expectRejected(
      db`
        INSERT INTO public.sessions (owner_id, kind, played_on, result)
        VALUES (${a.id}, 'training', current_date, 'win')
      `,
    );
  });

  it('un participante es usuario O invitado, nunca los dos', async () => {
    const a = await createUser();
    const b = await createUser();
    const [s] = await db`
      INSERT INTO public.sessions (owner_id, kind, played_on, result)
      VALUES (${a.id}, 'match', current_date, 'win') RETURNING id
    `;

    await expectRejected(
      db`
        INSERT INTO public.session_participants (session_id, profile_id, guest_name, team)
        VALUES (${s!.id}, ${b.id}, 'Pepe', 'mine')
      `,
    );
  });
});

describe('RLS · valoraciones de nivel', () => {
  beforeEach(truncateAll);

  async function seedConfirmed(owner: string, other: string) {
    const [s] = await db`
      INSERT INTO public.sessions (owner_id, kind, played_on, result)
      VALUES (${owner}, 'match', current_date, 'win') RETURNING id
    `;
    const sid = s!.id as string;
    await db`
      INSERT INTO public.session_participants (session_id, profile_id, team, confirmed_at)
      VALUES (${sid}, ${owner}, 'mine', now()),
             (${sid}, ${other}, 'opponent', now())
    `;
    return sid;
  }

  it('se puede valorar a quien jugó con vos', async () => {
    const a = await createUser();
    const b = await createUser();
    const sid = await seedConfirmed(a.id, b.id);

    await asUser(a.id, (sql) =>
      sql`
        INSERT INTO public.level_ratings (session_id, rater_id, subject_id, value)
        VALUES (${sid}, ${a.id}, ${b.id}, 5.0)
      `,
    );

    const [row] = await db`SELECT count(*)::int AS n FROM public.level_ratings`;
    expect(row?.n).toBe(1);
  });

  it('NO se puede valorar a alguien con quien no jugaste', async () => {
    const a = await createUser();
    const b = await createUser();
    const c = await createUser();
    const sid = await seedConfirmed(a.id, b.id);

    await expectRejected(
      asUser(a.id, (sql) =>
        sql`
          INSERT INTO public.level_ratings (session_id, rater_id, subject_id, value)
          VALUES (${sid}, ${a.id}, ${c.id}, 1.0)
        `,
      ),
    );
  });

  it('NO se puede valorar en nombre de otro', async () => {
    const a = await createUser();
    const b = await createUser();
    const sid = await seedConfirmed(a.id, b.id);

    await expectRejected(
      asUser(b.id, (sql) =>
        sql`
          INSERT INTO public.level_ratings (session_id, rater_id, subject_id, value)
          VALUES (${sid}, ${a.id}, ${b.id}, 1.0)
        `,
      ),
    );
  });

  /**
   * Regla 12: se publica el agregado, nunca quién puso qué. Si se supiera,
   * aparecen las represalias y la gente empieza a votar político.
   */
  it('nadie ve las valoraciones que recibió', async () => {
    const a = await createUser();
    const b = await createUser();
    const sid = await seedConfirmed(a.id, b.id);

    await db`
      INSERT INTO public.level_ratings (session_id, rater_id, subject_id, value)
      VALUES (${sid}, ${a.id}, ${b.id}, 2.0)
    `;

    const comoVictima = await asUser(b.id, (sql) =>
      sql`SELECT * FROM public.level_ratings`,
    );
    expect(comoVictima).toHaveLength(0);

    const comoVotante = await asUser(a.id, (sql) =>
      sql`SELECT * FROM public.level_ratings`,
    );
    expect(comoVotante).toHaveLength(1);
  });

  it('un mismo votante no puede valorar dos veces el mismo partido', async () => {
    const a = await createUser();
    const b = await createUser();
    const sid = await seedConfirmed(a.id, b.id);

    await db`
      INSERT INTO public.level_ratings (session_id, rater_id, subject_id, value)
      VALUES (${sid}, ${a.id}, ${b.id}, 4.0)
    `;
    await expectRejected(
      db`
        INSERT INTO public.level_ratings (session_id, rater_id, subject_id, value)
        VALUES (${sid}, ${a.id}, ${b.id}, 6.0)
      `,
    );
  });
});
