import { beforeEach, describe, expect, it } from 'vitest';

import { asUser, createUser, db, truncateAll } from './helpers';

/**
 * `INSERT ... RETURNING` en todas las tablas donde la app da de alta.
 *
 * Existe por un bug real: la política de SELECT de `sessions` usaba una función
 * SECURITY DEFINER que volvía a consultar la propia tabla. Durante un INSERT
 * esa consulta usa el snapshot de la sentencia, que es anterior a la fila nueva,
 * así que no la encontraba y el RETURNING se rechazaba — con un mensaje de RLS
 * que no apuntaba a la causa.
 *
 * El INSERT sin RETURNING funcionaba, así que los tests de RLS del bloque 2 no
 * lo detectaron. Pero toda alta real necesita el id de vuelta.
 *
 * Regla que dejan estos tests: **una política de SELECT no debe re-consultar su
 * propia tabla.** Comparar columnas directamente.
 */
describe('INSERT ... RETURNING funciona para el que inserta', () => {
  beforeEach(truncateAll);

  it('sessions', async () => {
    const a = await createUser();

    const rows = await asUser(a.id, (sql) =>
      sql`
        INSERT INTO public.sessions (owner_id, kind, played_on, result, sets)
        VALUES (${a.id}, 'match', current_date, 'win',
                ${JSON.stringify([{ me: 6, opp: 3 }])}::jsonb)
        RETURNING id
      `,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBeTruthy();
  });

  it('session_participants', async () => {
    const a = await createUser();
    const b = await createUser();

    const [session] = await asUser(a.id, (sql) =>
      sql`
        INSERT INTO public.sessions (owner_id, kind, played_on, result)
        VALUES (${a.id}, 'match', current_date, 'win') RETURNING id
      `,
    );

    const rows = await asUser(a.id, (sql) =>
      sql`
        INSERT INTO public.session_participants (session_id, profile_id, team)
        VALUES (${session!.id}, ${b.id}, 'opponent')
        RETURNING id
      `,
    );

    expect(rows).toHaveLength(1);
  });

  it('match_offers', async () => {
    const a = await createUser();

    const rows = await asUser(a.id, (sql) =>
      sql`
        INSERT INTO public.match_offers (
          creator_id, starts_at, timezone, level_min, level_max,
          spots_open, guests_count
        ) VALUES (
          ${a.id}, now() + interval '2 days', 'UTC', 3.0, 5.0, 3, 0
        ) RETURNING id
      `,
    );

    expect(rows).toHaveLength(1);
  });

  it('match_participants', async () => {
    const a = await createUser({ effectiveLevel: 4.0 });
    const b = await createUser({ effectiveLevel: 4.0 });

    const [offer] = await asUser(a.id, (sql) =>
      sql`
        INSERT INTO public.match_offers (
          creator_id, starts_at, timezone, level_min, level_max,
          spots_open, guests_count
        ) VALUES (${a.id}, now() + interval '2 days', 'UTC', 3.0, 5.0, 3, 0)
        RETURNING id
      `,
    );

    const rows = await asUser(b.id, (sql) =>
      sql`
        INSERT INTO public.match_participants (offer_id, profile_id)
        VALUES (${offer!.id}, ${b.id})
        RETURNING id
      `,
    );

    expect(rows).toHaveLength(1);
  });

  it('match_invitations', async () => {
    const a = await createUser();
    const b = await createUser();

    const [offer] = await asUser(a.id, (sql) =>
      sql`
        INSERT INTO public.match_offers (
          creator_id, starts_at, timezone, level_min, level_max,
          spots_open, guests_count
        ) VALUES (${a.id}, now() + interval '2 days', 'UTC', 3.0, 5.0, 3, 0)
        RETURNING id
      `,
    );

    const rows = await asUser(a.id, (sql) =>
      sql`
        INSERT INTO public.match_invitations
          (offer_id, inviter_id, invitee_id, expires_at)
        VALUES (${offer!.id}, ${a.id}, ${b.id}, now() + interval '1 day')
        RETURNING id
      `,
    );

    expect(rows).toHaveLength(1);
  });

  it('level_ratings', async () => {
    const a = await createUser();
    const b = await createUser({ effectiveLevel: 4.0 });

    const [session] = await asUser(a.id, (sql) =>
      sql`
        INSERT INTO public.sessions (owner_id, kind, played_on, result)
        VALUES (${a.id}, 'match', current_date, 'win') RETURNING id
      `,
    );
    await db`
      INSERT INTO public.session_participants (session_id, profile_id, team, confirmed_at)
      VALUES (${session!.id}, ${a.id}, 'mine', now()),
             (${session!.id}, ${b.id}, 'opponent', now())
    `;

    const rows = await asUser(a.id, (sql) =>
      sql`
        INSERT INTO public.level_ratings (session_id, rater_id, subject_id, value)
        VALUES (${session!.id}, ${a.id}, ${b.id}, 4.5)
        RETURNING id
      `,
    );

    expect(rows).toHaveLength(1);
  });

  it('venues', async () => {
    const a = await createUser();

    const rows = await asUser(a.id, (sql) =>
      sql`
        INSERT INTO public.venues
          (name, country_code, location, timezone, source, status, submitted_by)
        VALUES ('Club Nuevo', 'AR', ST_MakePoint(-58.4, -34.6)::geography,
                'America/Argentina/Buenos_Aires', 'user', 'pending', ${a.id})
        RETURNING id
      `,
    );

    expect(rows).toHaveLength(1);
  });

  it('blocks y follows', async () => {
    const a = await createUser();
    const b = await createUser();

    const blocked = await asUser(a.id, (sql) =>
      sql`
        INSERT INTO public.blocks (blocker_id, blocked_id)
        VALUES (${a.id}, ${b.id}) RETURNING blocker_id
      `,
    );
    expect(blocked).toHaveLength(1);

    const c = await createUser();
    const followed = await asUser(a.id, (sql) =>
      sql`
        INSERT INTO public.follows (follower_id, followee_id)
        VALUES (${a.id}, ${c.id}) RETURNING follower_id
      `,
    );
    expect(followed).toHaveLength(1);
  });

  it('push_subscriptions', async () => {
    const a = await createUser();

    const rows = await asUser(a.id, (sql) =>
      sql`
        INSERT INTO public.push_subscriptions
          (profile_id, endpoint, p256dh, auth_key)
        VALUES (${a.id}, 'https://push.example/abc', 'clave-p256', 'clave-auth')
        RETURNING id
      `,
    );

    expect(rows).toHaveLength(1);
  });

  it('abuse_reports', async () => {
    const a = await createUser();
    const b = await createUser();

    // Solo tiene INSERT y SELECT, sin RETURNING de columnas ajenas.
    const rows = await asUser(a.id, (sql) =>
      sql`
        INSERT INTO public.abuse_reports
          (reporter_id, target_type, target_id, reason)
        VALUES (${a.id}, 'profile', ${b.id}, 'motivo de prueba')
        RETURNING id
      `,
    );

    expect(rows).toHaveLength(1);
  });
});

/**
 * Guarda estructural: ninguna política de SELECT debe llamar a una función
 * que vuelva a consultar la MISMA tabla. Es la causa raíz del bug de arriba, y
 * es fácil de reintroducir sin darse cuenta.
 */
describe('las políticas de SELECT no re-consultan su propia tabla', () => {
  it('ninguna política de SELECT usa app.can_see_session', async () => {
    const rows = await db`
      SELECT c.relname AS tabla, p.polname
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      WHERE p.polcmd = 'r'
        AND pg_get_expr(p.polqual, p.polrelid) LIKE '%can_see_session%'
    `;
    expect(rows.map((r) => `${r.tabla}.${r.polname}`)).toEqual([]);
  });
});
