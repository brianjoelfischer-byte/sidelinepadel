import { beforeEach, describe, expect, it } from 'vitest';

import { asUser, createUser, db, expectRejected, truncateAll } from './helpers';

async function seedOffer(
  creator: string,
  opts: { levelMin?: number; levelMax?: number; visibility?: string } = {},
) {
  const [row] = await db`
    INSERT INTO public.match_offers (
      creator_id, starts_at, timezone, level_min, level_max,
      spots_open, guests_count, visibility
    ) VALUES (
      ${creator}, now() + interval '2 days', 'America/Argentina/Buenos_Aires',
      ${opts.levelMin ?? 3.5}, ${opts.levelMax ?? 4.5},
      3, 0, ${opts.visibility ?? 'public'}
    ) RETURNING id
  `;
  return row!.id as string;
}

describe('turnos · un turno es siempre 4 jugadores', () => {
  beforeEach(truncateAll);

  it('acepta 1 creador + 3 buscados', async () => {
    const a = await createUser();
    const id = await seedOffer(a.id);
    expect(id).toBeTruthy();
  });

  it('acepta 1 creador + 1 invitado externo + 2 buscados', async () => {
    const a = await createUser();
    const [row] = await db`
      INSERT INTO public.match_offers (
        creator_id, starts_at, timezone, level_min, level_max,
        spots_open, guests_count
      ) VALUES (
        ${a.id}, now() + interval '2 days', 'UTC', 3.0, 5.0, 2, 1
      ) RETURNING id
    `;
    expect(row?.id).toBeTruthy();
  });

  it('RECHAZA un turno de 3 jugadores', async () => {
    const a = await createUser();
    await expectRejected(
      db`
        INSERT INTO public.match_offers (
          creator_id, starts_at, timezone, level_min, level_max,
          spots_open, guests_count
        ) VALUES (${a.id}, now() + interval '2 days', 'UTC', 3.0, 5.0, 2, 0)
      `,
    );
  });

  it('RECHAZA un turno de 5 jugadores', async () => {
    const a = await createUser();
    await expectRejected(
      db`
        INSERT INTO public.match_offers (
          creator_id, starts_at, timezone, level_min, level_max,
          spots_open, guests_count
        ) VALUES (${a.id}, now() + interval '2 days', 'UTC', 3.0, 5.0, 3, 1)
      `,
    );
  });

  it('RECHAZA una banda de nivel invertida', async () => {
    const a = await createUser();
    await expectRejected(
      db`
        INSERT INTO public.match_offers (
          creator_id, starts_at, timezone, level_min, level_max,
          spots_open, guests_count
        ) VALUES (${a.id}, now() + interval '2 days', 'UTC', 5.0, 3.0, 3, 0)
      `,
    );
  });
});

describe('turnos · los dos ejes están separados', () => {
  beforeEach(truncateAll);

  it('un turno nace sin cancha y con el cupo abierto', async () => {
    const a = await createUser();
    const id = await seedOffer(a.id);
    const [row] = await db`
      SELECT court_status, roster_status FROM public.match_offers WHERE id = ${id}
    `;
    expect(row?.court_status).toBe('pending');
    expect(row?.roster_status).toBe('open');
  });

  it('NO se puede crear un turno ya con la cancha asegurada', async () => {
    // Saltearse el paso explícito del §12.7 es justo lo que hay que impedir.
    const a = await createUser();
    await expectRejected(
      asUser(a.id, (sql) =>
        sql`
          INSERT INTO public.match_offers (
            creator_id, starts_at, timezone, level_min, level_max,
            spots_open, guests_count, court_status
          ) VALUES (
            ${a.id}, now() + interval '2 days', 'UTC', 3.0, 5.0, 3, 0, 'secured'
          )
        `,
      ),
    );
  });

  it('perder la cancha NO toca el cupo', async () => {
    const a = await createUser();
    const b = await createUser({ effectiveLevel: 4.0 });
    const id = await seedOffer(a.id);

    await asUser(b.id, (sql) =>
      sql`
        INSERT INTO public.match_participants (offer_id, profile_id)
        VALUES (${id}, ${b.id})
      `,
    );

    await asUser(a.id, (sql) =>
      sql`
        UPDATE public.match_offers
        SET court_status = 'lost', court_lost_reason = 'el club la dio de baja'
        WHERE id = ${id}
      `,
    );

    // El grupo sigue armado: el creador puede conseguir otra cancha sin
    // rearmar el equipo. Es la razón de separar los ejes (regla 3).
    const [offer] = await db`
      SELECT court_status, roster_status FROM public.match_offers WHERE id = ${id}
    `;
    expect(offer?.court_status).toBe('lost');
    expect(offer?.roster_status).toBe('open');

    const [count] = await db`
      SELECT count(*)::int AS n FROM public.match_participants WHERE offer_id = ${id}
    `;
    expect(count?.n).toBe(1);
  });
});

describe('turnos · banda de nivel', () => {
  beforeEach(truncateAll);

  it('alguien dentro de la banda se puede anotar', async () => {
    const a = await createUser({ effectiveLevel: 4.0 });
    const b = await createUser({ effectiveLevel: 4.0 });
    const id = await seedOffer(a.id, { levelMin: 3.5, levelMax: 4.5 });

    await asUser(b.id, (sql) =>
      sql`
        INSERT INTO public.match_participants (offer_id, profile_id)
        VALUES (${id}, ${b.id})
      `,
    );

    const [row] = await db`
      SELECT count(*)::int AS n FROM public.match_participants WHERE offer_id = ${id}
    `;
    expect(row?.n).toBe(1);
  });

  /**
   * La regla se aplica en la BASE, no ocultando el botón en la interfaz
   * (§12.5). Alguien que llame la API directo tiene que chocar igual.
   */
  it('alguien fuera de la banda NO se puede anotar', async () => {
    const a = await createUser({ effectiveLevel: 4.0 });
    const b = await createUser({ effectiveLevel: 6.5 });
    const id = await seedOffer(a.id, { levelMin: 3.5, levelMax: 4.5 });

    await expectRejected(
      asUser(b.id, (sql) =>
        sql`
          INSERT INTO public.match_participants (offer_id, profile_id)
          VALUES (${id}, ${b.id})
        `,
      ),
    );
  });

  it('usa el nivel EFECTIVO, no el declarado', async () => {
    const a = await createUser({ effectiveLevel: 4.0 });
    // Declara 4.0 pero la comunidad lo puso en 6.5: queda fuera.
    const b = await createUser({ declaredLevel: 4.0, effectiveLevel: 6.5 });
    const id = await seedOffer(a.id, { levelMin: 3.5, levelMax: 4.5 });

    await expectRejected(
      asUser(b.id, (sql) =>
        sql`
          INSERT INTO public.match_participants (offer_id, profile_id)
          VALUES (${id}, ${b.id})
        `,
      ),
    );
  });

  it('una invitación directa SÍ saltea la banda', async () => {
    const a = await createUser({ effectiveLevel: 4.0 });
    const b = await createUser({ effectiveLevel: 6.5 });
    const id = await seedOffer(a.id, { levelMin: 3.5, levelMax: 4.5 });

    await asUser(a.id, (sql) =>
      sql`
        INSERT INTO public.match_invitations (offer_id, inviter_id, invitee_id, expires_at)
        VALUES (${id}, ${a.id}, ${b.id}, now() + interval '1 day')
      `,
    );

    await asUser(b.id, (sql) =>
      sql`
        INSERT INTO public.match_participants (offer_id, profile_id, origin)
        VALUES (${id}, ${b.id}, 'invitation')
      `,
    );

    const [row] = await db`
      SELECT count(*)::int AS n FROM public.match_participants WHERE offer_id = ${id}
    `;
    expect(row?.n).toBe(1);
  });

  it('NO se puede anotar a otro en un turno', async () => {
    const a = await createUser();
    const b = await createUser({ effectiveLevel: 4.0 });
    const c = await createUser({ effectiveLevel: 4.0 });
    const id = await seedOffer(a.id);

    await expectRejected(
      asUser(b.id, (sql) =>
        sql`
          INSERT INTO public.match_participants (offer_id, profile_id)
          VALUES (${id}, ${c.id})
        `,
      ),
    );
  });
});

describe('turnos · asistencia', () => {
  beforeEach(truncateAll);

  it('un tentativo necesita fecha de vencimiento', async () => {
    const a = await createUser();
    const b = await createUser({ effectiveLevel: 4.0 });
    const id = await seedOffer(a.id);

    await asUser(b.id, (sql) =>
      sql`INSERT INTO public.match_participants (offer_id, profile_id) VALUES (${id}, ${b.id})`,
    );

    // Sin `tentative_until` un tentativo retendría un lugar para siempre.
    await expectRejected(
      db`
        UPDATE public.match_participants SET attendance = 'tentative'
        WHERE offer_id = ${id} AND profile_id = ${b.id}
      `,
    );

    await db`
      UPDATE public.match_participants
      SET attendance = 'tentative', tentative_until = now() + interval '6 hours'
      WHERE offer_id = ${id} AND profile_id = ${b.id}
    `;
    const [row] = await db`
      SELECT attendance FROM public.match_participants
      WHERE offer_id = ${id} AND profile_id = ${b.id}
    `;
    expect(row?.attendance).toBe('tentative');
  });

  it('nadie puede cambiar la asistencia de otro', async () => {
    const a = await createUser();
    const b = await createUser({ effectiveLevel: 4.0 });
    const c = await createUser({ effectiveLevel: 4.0 });
    const id = await seedOffer(a.id);

    await asUser(b.id, (sql) =>
      sql`INSERT INTO public.match_participants (offer_id, profile_id) VALUES (${id}, ${b.id})`,
    );

    await asUser(c.id, (sql) =>
      sql`
        UPDATE public.match_participants SET attendance = 'not_going'
        WHERE offer_id = ${id} AND profile_id = ${b.id}
      `,
    );

    const [row] = await db`
      SELECT attendance FROM public.match_participants
      WHERE offer_id = ${id} AND profile_id = ${b.id}
    `;
    expect(row?.attendance).toBe('pending');
  });
});

describe('turnos · visibilidad', () => {
  beforeEach(truncateAll);

  it('un turno público lo ve cualquiera', async () => {
    const a = await createUser();
    const b = await createUser();
    const id = await seedOffer(a.id, { visibility: 'public' });

    const rows = await asUser(b.id, (sql) =>
      sql`SELECT id FROM public.match_offers WHERE id = ${id}`,
    );
    expect(rows).toHaveLength(1);
  });

  it('un turno invite_only NO lo ve un extraño', async () => {
    const a = await createUser();
    const b = await createUser();
    const id = await seedOffer(a.id, { visibility: 'invite_only' });

    const rows = await asUser(b.id, (sql) =>
      sql`SELECT id FROM public.match_offers WHERE id = ${id}`,
    );
    expect(rows).toHaveLength(0);
  });

  it('un turno invite_only SÍ lo ve el invitado', async () => {
    const a = await createUser();
    const b = await createUser();
    const id = await seedOffer(a.id, { visibility: 'invite_only' });

    await asUser(a.id, (sql) =>
      sql`
        INSERT INTO public.match_invitations (offer_id, inviter_id, invitee_id, expires_at)
        VALUES (${id}, ${a.id}, ${b.id}, now() + interval '1 day')
      `,
    );

    const rows = await asUser(b.id, (sql) =>
      sql`SELECT id FROM public.match_offers WHERE id = ${id}`,
    );
    expect(rows).toHaveLength(1);
  });

  it('un turno de alguien bloqueado no aparece', async () => {
    const a = await createUser();
    const b = await createUser();
    const id = await seedOffer(a.id);

    await asUser(b.id, (sql) =>
      sql`INSERT INTO public.blocks (blocker_id, blocked_id) VALUES (${b.id}, ${a.id})`,
    );

    const rows = await asUser(b.id, (sql) =>
      sql`SELECT id FROM public.match_offers WHERE id = ${id}`,
    );
    expect(rows).toHaveLength(0);
  });

  it('solo el creador invita a su turno', async () => {
    const a = await createUser();
    const b = await createUser();
    const c = await createUser();
    const id = await seedOffer(a.id);

    await expectRejected(
      asUser(b.id, (sql) =>
        sql`
          INSERT INTO public.match_invitations (offer_id, inviter_id, invitee_id, expires_at)
          VALUES (${id}, ${b.id}, ${c.id}, now() + interval '1 day')
        `,
      ),
    );
  });
});
