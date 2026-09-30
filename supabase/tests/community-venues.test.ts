import { beforeEach, describe, expect, it } from 'vitest';

import { asUser, createUser, db, expectRejected, truncateAll } from './helpers';

/**
 * Clubes agregados por jugadores · migración 13.
 *
 * La pregunta de fondo: con miles de jugadores agregando clubes, ¿se evita que
 * el mismo club termine cargado cinco veces con cinco nombres?
 */

async function osmVenue(name: string, city: string, opts: { area?: string; lng?: number; lat?: number } = {}) {
  const [row] = await db`
    INSERT INTO public.venues
      (name, country_code, admin_area, city, location, timezone, source, osm_type, osm_id, status)
    VALUES (${name}, 'AR', ${opts.area ?? null}, ${city},
            ST_SetSRID(ST_MakePoint(${opts.lng ?? -64.18}, ${opts.lat ?? -31.42}), 4326)::geography,
            'America/Argentina/Cordoba', 'osm', 'node', ${Math.floor(Math.random() * 1e9)}, 'approved')
    RETURNING id
  `;
  return row!.id as string;
}

function submit(
  userId: string,
  name: string,
  city: string,
  opts: { area?: string; lat?: number; lng?: number } = {},
) {
  return asUser(userId, (sql) =>
    sql`
      SELECT id, created FROM public.submit_venue(
        ${name}, 'AR', ${opts.area ?? 'Córdoba'}, ${city}, NULL,
        ${opts.lat ?? null}, ${opts.lng ?? null}
      )
    `,
  ).then((rows) => rows[0] as { id: string; created: boolean });
}

function similar(userId: string, name: string, city: string, area: string | null = 'Córdoba') {
  return asUser(userId, (sql) =>
    sql`SELECT name, same_name FROM public.similar_venues(${name}, 'AR', ${area}, ${city})`,
  );
}

describe('nombre núcleo', () => {
  it('ignora tildes, mayúsculas, signos y palabras de relleno', async () => {
    const rows = await db`
      SELECT app.venue_core_name(n) AS core
      FROM unnest(ARRAY['Club Alemán Pádel', 'Padel Club Aleman', 'CLUB ALEMÁN', 'club aleman.']) AS n
    `;
    expect(new Set(rows.map((r) => r.core))).toEqual(new Set(['aleman']));
  });

  /** Si el núcleo quedara vacío, todos los "Club de Pádel" serían el mismo. */
  it('un nombre que es solo relleno queda entero', async () => {
    const [row] = await db`SELECT app.venue_core_name('Club de Pádel') AS core`;
    expect(row?.core).toBe('club de padel');
  });
});

describe('alta de un club', () => {
  beforeEach(truncateAll);

  it('crea el club, pendiente y a nombre de quien lo agrega', async () => {
    const a = await createUser();
    const r = await submit(a.id, 'Punto de Oro', 'Córdoba');
    expect(r.created).toBe(true);

    const [v] = await db`SELECT status, source, submitted_by, admin_area FROM public.venues WHERE id = ${r.id}`;
    expect(v).toMatchObject({ status: 'pending', source: 'user', submitted_by: a.id, admin_area: 'Córdoba' });
  });

  /** El corazón del pedido: el segundo que lo sube se encuentra con el primero. */
  it('el mismo club escrito distinto en la misma ciudad no se duplica', async () => {
    const a = await createUser();
    const b = await createUser();
    const primero = await submit(a.id, 'Club Alemán Pádel', 'Córdoba');
    const segundo = await submit(b.id, 'padel club aleman', 'cordoba');

    expect(segundo).toEqual({ id: primero.id, created: false });
    const [n] = await db`SELECT count(*)::int AS n FROM public.venues`;
    expect(n?.n).toBe(1);
  });

  it('tampoco duplica uno que ya estaba en OpenStreetMap', async () => {
    const a = await createUser();
    const osm = await osmVenue('Club Alemán', 'Córdoba');
    const r = await submit(a.id, 'Aleman Padel', 'Córdoba');
    expect(r).toEqual({ id: osm, created: false });
  });

  it('el mismo nombre en otra ciudad es otro club', async () => {
    const a = await createUser();
    const cba = await submit(a.id, 'Club Alemán', 'Córdoba');
    const ros = await submit(a.id, 'Club Alemán', 'Rosario', { area: 'Santa Fe' });
    expect(ros.created).toBe(true);
    expect(ros.id).not.toBe(cba.id);
  });

  it('a menos de 300 m es el mismo club aunque la ciudad se haya escrito distinto', async () => {
    const a = await createUser();
    const osm = await osmVenue('Top Pádel', 'Córdoba', { lat: -31.42, lng: -64.18 });
    const r = await submit(a.id, 'Top Padel', 'Cordoba Capital', { lat: -31.4205, lng: -64.1803 });
    expect(r).toEqual({ id: osm, created: false });
  });

  /**
   * La garantía de fondo, sin pasar por la función: el índice único impide
   * dos altas con el mismo núcleo en la misma ciudad aunque lleguen juntas.
   */
  it('dos altas simultáneas no pueden convivir', async () => {
    const a = await createUser();
    const b = await createUser();
    await submit(a.id, 'La Cancha', 'Córdoba');
    await expectRejected(
      asUser(b.id, (sql) =>
        sql`
          INSERT INTO public.venues (name, country_code, city, timezone, source, status, submitted_by)
          VALUES ('Club La Cancha', 'AR', 'córdoba', 'UTC', 'user', 'pending', ${b.id})
        `,
      ),
    );
  });

  it('sin ciudad no se puede agregar', async () => {
    const a = await createUser();
    await expectRejected(submit(a.id, 'Club Sin Ciudad', ' '));
  });

  it('nadie crea un club "usado por 99 jugadores"', async () => {
    const a = await createUser();
    await expectRejected(
      asUser(a.id, (sql) =>
        sql`
          INSERT INTO public.venues (name, country_code, city, timezone, source, status, submitted_by, players_count)
          VALUES ('Inflado', 'AR', 'Córdoba', 'UTC', 'user', 'pending', ${a.id}, 99)
        `,
      ),
    );
  });
});

describe('¿es alguno de estos?', () => {
  beforeEach(truncateAll);

  it('ofrece el parecido aunque tenga un error de tipeo', async () => {
    const a = await createUser();
    await osmVenue('La Raquette', 'Córdoba');
    const rows = await similar(a.id, 'Raquete Padel', 'Córdoba');
    expect(rows.map((r) => r.name)).toEqual(['La Raquette']);
  });

  it('con la misma provincia alcanza si la ciudad se escribió distinto', async () => {
    const a = await createUser();
    await osmVenue('Club Alemán', 'Córdoba', { area: 'Córdoba' });
    const rows = await similar(a.id, 'Club Aleman', 'Cordoba Capital', 'Córdoba');
    expect(rows).toEqual([{ name: 'Club Alemán', same_name: true }]);
  });

  it('no ofrece clubes de otra ciudad y otra provincia', async () => {
    const a = await createUser();
    await osmVenue('Club Alemán', 'Rosario', { area: 'Santa Fe', lat: -32.9, lng: -60.6 });
    expect(await similar(a.id, 'Club Aleman', 'Córdoba', 'Córdoba')).toEqual([]);
  });

  it('no ofrece clubes que no se parecen', async () => {
    const a = await createUser();
    await osmVenue('Top Pádel', 'Córdoba');
    expect(await similar(a.id, 'Belgrano', 'Córdoba')).toEqual([]);
  });
});

describe('verificación por la comunidad', () => {
  beforeEach(truncateAll);

  async function playAt(userId: string, venueId: string) {
    await asUser(userId, (sql) =>
      sql`
        INSERT INTO public.sessions (owner_id, kind, played_on, result, venue_id)
        VALUES (${userId}, 'match', current_date, 'win', ${venueId})
      `,
    );
  }

  it('cuenta jugadores distintos, no partidos', async () => {
    const a = await createUser();
    const { id } = await submit(a.id, 'Club Nuevo', 'Córdoba');
    await playAt(a.id, id);
    await playAt(a.id, id);

    const [v] = await db`SELECT players_count, status FROM public.venues WHERE id = ${id}`;
    expect(v).toMatchObject({ players_count: 1, status: 'pending' });
  });

  it('con 3 jugadores distintos queda verificado', async () => {
    const [a, b, c] = [await createUser(), await createUser(), await createUser()];
    const { id } = await submit(a.id, 'Club Nuevo', 'Córdoba');
    await playAt(a.id, id);
    await playAt(b.id, id);
    let [v] = await db`SELECT status FROM public.venues WHERE id = ${id}`;
    expect(v?.status).toBe('pending');

    await playAt(c.id, id);
    [v] = await db`SELECT players_count, status FROM public.venues WHERE id = ${id}`;
    expect(v).toMatchObject({ players_count: 3, status: 'approved' });
  });

  it('borrar el partido resta', async () => {
    const a = await createUser();
    const { id } = await submit(a.id, 'Club Nuevo', 'Córdoba');
    await playAt(a.id, id);
    await asUser(a.id, (sql) => sql`DELETE FROM public.sessions WHERE venue_id = ${id}`);

    const [v] = await db`SELECT players_count FROM public.venues WHERE id = ${id}`;
    expect(v?.players_count).toBe(0);
  });

  /** Un moderador que rechazó un club inventado no es pisado por tres cuentas. */
  it('nunca revierte un rechazo', async () => {
    const [a, b, c] = [await createUser(), await createUser(), await createUser()];
    const { id } = await submit(a.id, 'Club Trucho', 'Córdoba');
    await db`UPDATE public.venues SET status = 'rejected' WHERE id = ${id}`;
    for (const u of [a, b, c]) await playAt(u.id, id);

    const [v] = await db`SELECT status FROM public.venues WHERE id = ${id}`;
    expect(v?.status).toBe('rejected');
  });
});
