import { beforeEach, describe, expect, it } from 'vitest';

import { asUser, createUser, db, expectRejected, truncateAll } from './helpers';

/**
 * Flujo completo de registrar un partido.
 *
 * Los tests de RLS del bloque 2 prueban que A no lee lo de B. Estos prueban
 * otra cosa: que los datos que entran a la base tengan sentido como partido de
 * pádel, y que el historial de alguien no se pueda escribir desde afuera.
 */

describe('registrar una sesión', () => {
  beforeEach(truncateAll);

  it('guarda un partido con sus sets', async () => {
    const a = await createUser();

    const rows = await asUser(a.id, (sql) =>
      sql`
        INSERT INTO public.sessions (owner_id, kind, played_on, result, sets)
        VALUES (${a.id}, 'match', current_date, 'win',
                ${JSON.stringify([{ me: 6, opp: 3 }, { me: 6, opp: 4 }])}::jsonb)
        RETURNING id, result
      `,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.result).toBe('win');
  });

  it('un entrenamiento no puede llevar resultado', async () => {
    const a = await createUser();
    await expectRejected(
      db`
        INSERT INTO public.sessions (owner_id, kind, played_on, result)
        VALUES (${a.id}, 'training', current_date, 'win')
      `,
    );
  });

  it('un partido exige resultado', async () => {
    const a = await createUser();
    await expectRejected(
      db`
        INSERT INTO public.sessions (owner_id, kind, played_on)
        VALUES (${a.id}, 'match', current_date)
      `,
    );
  });

  it('las notas tienen tope de 160 caracteres', async () => {
    const a = await createUser();
    await expectRejected(
      db`
        INSERT INTO public.sessions (owner_id, kind, played_on, result, notes)
        VALUES (${a.id}, 'match', current_date, 'win', ${'x'.repeat(161)})
      `,
    );
  });

  it('la autovaloración va de 1 a 10', async () => {
    const a = await createUser();
    await expectRejected(
      db`
        INSERT INTO public.sessions (owner_id, kind, played_on, result, self_rating)
        VALUES (${a.id}, 'match', current_date, 'win', 11)
      `,
    );
  });
});

describe('participantes y confirmación de etiqueta', () => {
  beforeEach(truncateAll);

  async function sessionWithTag(owner: string, tagged: string) {
    const [s] = await db`
      INSERT INTO public.sessions (owner_id, kind, played_on, result)
      VALUES (${owner}, 'match', current_date, 'win') RETURNING id
    `;
    await db`
      INSERT INTO public.session_participants (session_id, profile_id, team)
      VALUES (${s!.id}, ${tagged}, 'opponent')
    `;
    return s!.id as string;
  }

  /**
   * El corazón del §05: lo que A escribe sobre B no entra al historial de B
   * hasta que B lo confirme. Sin esto cualquiera podría inflar o ensuciar las
   * estadísticas ajenas.
   */
  it('un etiquetado puede aceptar', async () => {
    const a = await createUser();
    const b = await createUser();
    const sid = await sessionWithTag(a.id, b.id);

    await asUser(b.id, (sql) =>
      sql`
        UPDATE public.session_participants SET confirmed_at = now()
        WHERE session_id = ${sid} AND profile_id = ${b.id}
      `,
    );

    const [row] = await db`
      SELECT confirmed_at FROM public.session_participants
      WHERE session_id = ${sid} AND profile_id = ${b.id}
    `;
    expect(row?.confirmed_at).not.toBeNull();
  });

  it('un etiquetado puede rechazar', async () => {
    const a = await createUser();
    const b = await createUser();
    const sid = await sessionWithTag(a.id, b.id);

    await asUser(b.id, (sql) =>
      sql`
        UPDATE public.session_participants SET rejected_at = now()
        WHERE session_id = ${sid} AND profile_id = ${b.id}
      `,
    );

    const [row] = await db`
      SELECT rejected_at, confirmed_at FROM public.session_participants
      WHERE session_id = ${sid} AND profile_id = ${b.id}
    `;
    expect(row?.rejected_at).not.toBeNull();
    expect(row?.confirmed_at).toBeNull();
  });

  it('no se puede aceptar y rechazar a la vez', async () => {
    const a = await createUser();
    const b = await createUser();
    const sid = await sessionWithTag(a.id, b.id);

    await expectRejected(
      db`
        UPDATE public.session_participants
        SET confirmed_at = now(), rejected_at = now()
        WHERE session_id = ${sid} AND profile_id = ${b.id}
      `,
    );
  });

  it('un tercero no puede confirmar por otro', async () => {
    const a = await createUser();
    const b = await createUser();
    const c = await createUser();
    const sid = await sessionWithTag(a.id, b.id);

    await asUser(c.id, (sql) =>
      sql`
        UPDATE public.session_participants SET confirmed_at = now()
        WHERE session_id = ${sid} AND profile_id = ${b.id}
      `,
    );

    const [row] = await db`
      SELECT confirmed_at FROM public.session_participants
      WHERE session_id = ${sid} AND profile_id = ${b.id}
    `;
    expect(row?.confirmed_at).toBeNull();
  });

  it('un invitado suelto no necesita cuenta', async () => {
    const a = await createUser();
    const [s] = await db`
      INSERT INTO public.sessions (owner_id, kind, played_on, result)
      VALUES (${a.id}, 'match', current_date, 'win') RETURNING id
    `;

    await asUser(a.id, (sql) =>
      sql`
        INSERT INTO public.session_participants (session_id, guest_name, team)
        VALUES (${s!.id}, 'Pepe del club', 'opponent')
      `,
    );

    const [row] = await db`
      SELECT guest_name, profile_id FROM public.session_participants
      WHERE session_id = ${s!.id}
    `;
    expect(row?.guest_name).toBe('Pepe del club');
    expect(row?.profile_id).toBeNull();
  });

  it('la misma persona no aparece dos veces en un partido', async () => {
    const a = await createUser();
    const b = await createUser();
    const sid = await sessionWithTag(a.id, b.id);

    await expectRejected(
      db`
        INSERT INTO public.session_participants (session_id, profile_id, team)
        VALUES (${sid}, ${b.id}, 'mine')
      `,
    );
  });
});

describe('borrar una sesión', () => {
  beforeEach(truncateAll);

  it('el dueño puede borrar la suya', async () => {
    const a = await createUser();
    const [s] = await db`
      INSERT INTO public.sessions (owner_id, kind, played_on, result)
      VALUES (${a.id}, 'match', current_date, 'win') RETURNING id
    `;

    await asUser(a.id, (sql) =>
      sql`DELETE FROM public.sessions WHERE id = ${s!.id}`,
    );

    const [row] = await db`SELECT count(*)::int AS n FROM public.sessions`;
    expect(row?.n).toBe(0);
  });

  it('nadie puede borrar la sesión de otro', async () => {
    const a = await createUser();
    const b = await createUser();
    const [s] = await db`
      INSERT INTO public.sessions (owner_id, kind, played_on, result)
      VALUES (${a.id}, 'match', current_date, 'win') RETURNING id
    `;

    await asUser(b.id, (sql) =>
      sql`DELETE FROM public.sessions WHERE id = ${s!.id}`,
    );

    const [row] = await db`SELECT count(*)::int AS n FROM public.sessions`;
    expect(row?.n).toBe(1);
  });

  /** Borrar la sesión se lleva los participantes: no quedan filas huérfanas. */
  it('borrar arrastra a los participantes', async () => {
    const a = await createUser();
    const b = await createUser();
    const [s] = await db`
      INSERT INTO public.sessions (owner_id, kind, played_on, result)
      VALUES (${a.id}, 'match', current_date, 'win') RETURNING id
    `;
    await db`
      INSERT INTO public.session_participants (session_id, profile_id, team)
      VALUES (${s!.id}, ${b.id}, 'opponent')
    `;

    await asUser(a.id, (sql) =>
      sql`DELETE FROM public.sessions WHERE id = ${s!.id}`,
    );

    const [row] = await db`
      SELECT count(*)::int AS n FROM public.session_participants
    `;
    expect(row?.n).toBe(0);
  });
});
