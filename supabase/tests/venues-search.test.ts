import { beforeEach, describe, expect, it } from 'vitest';

import { asAnon, asUser, createUser, db, expectRejected, truncateAll } from './helpers';

/**
 * El buscador de "Dónde jugaste".
 *
 * Lo que se prueba es lo que un jugador espera sin pensarlo: que "padel"
 * encuentre "Pádel", que el nombre y la ciudad se puedan mezclar, que primero
 * salgan los clubes de su país — y lo que no debe pasar: que un "%" traiga la
 * base entera o que aparezca la propuesta pendiente de otro.
 */

async function venue(
  name: string,
  opts: {
    country?: string;
    city?: string;
    osmId?: number;
    status?: 'approved' | 'pending';
    submittedBy?: string;
  } = {},
) {
  const source = opts.submittedBy ? 'user' : 'osm';
  const [row] = await db`
    INSERT INTO public.venues
      (name, country_code, city, location, timezone, source, osm_type, osm_id,
       status, submitted_by)
    VALUES (
      ${name}, ${opts.country ?? 'AR'}, ${opts.city ?? null},
      ST_SetSRID(ST_MakePoint(-64.18, -31.42), 4326)::geography,
      'America/Argentina/Cordoba', ${source},
      ${source === 'osm' ? 'node' : null},
      ${source === 'osm' ? (opts.osmId ?? Math.floor(Math.random() * 1e9)) : null},
      ${opts.status ?? 'approved'}, ${opts.submittedBy ?? null}
    )
    RETURNING id
  `;
  return row!.id as string;
}

async function search(userId: string, q: string, country: string | null = 'AR') {
  const rows = await asUser(userId, (sql) =>
    sql`SELECT name, country_code FROM public.search_venues(${q}, ${country})`,
  );
  return rows.map((r) => r.name as string);
}

describe('búsqueda de sedes', () => {
  beforeEach(truncateAll);

  it('ignora tildes y mayúsculas', async () => {
    const a = await createUser();
    await venue('Top Pádel', { city: 'Córdoba' });

    expect(await search(a.id, 'PADEL')).toEqual(['Top Pádel']);
    expect(await search(a.id, 'cordoba')).toEqual(['Top Pádel']);
  });

  it('cada palabra puede estar en el nombre o en la ciudad', async () => {
    const a = await createUser();
    await venue('Club Atlético Belgrano', { city: 'Córdoba' });
    await venue('Belgrano Pádel', { city: 'Rosario' });

    expect(await search(a.id, 'belgrano cordoba')).toEqual(['Club Atlético Belgrano']);
  });

  it('primero las de tu país', async () => {
    const a = await createUser();
    await venue('Top Padel Madrid', { country: 'ES' });
    await venue('Top Pádel', { country: 'AR' });

    expect(await search(a.id, 'top', 'AR')).toEqual(['Top Pádel', 'Top Padel Madrid']);
    expect(await search(a.id, 'top', 'ES')).toEqual(['Top Padel Madrid', 'Top Pádel']);
  });

  it('dentro del país, primero las que empiezan con lo que escribiste', async () => {
    const a = await createUser();
    await venue('Club Top');
    await venue('Top Club');

    expect(await search(a.id, 'top')).toEqual(['Top Club', 'Club Top']);
  });

  /** Sin escapar, "%%" sería "cualquier cosa" y devolvería todas las sedes. */
  it('los comodines se toman literales', async () => {
    const a = await createUser();
    await venue('100% Pádel');
    await venue('Otro Club');

    expect(await search(a.id, '%%')).toEqual([]);
    expect(await search(a.id, '__')).toEqual([]);
    expect(await search(a.id, '0%')).toEqual(['100% Pádel']);
  });

  it('con menos de 2 letras no busca', async () => {
    const a = await createUser();
    await venue('Top Pádel');

    expect(await search(a.id, 't')).toEqual([]);
    expect(await search(a.id, '   ')).toEqual([]);
  });

  it('nunca devuelve más de 20', async () => {
    const a = await createUser();
    for (let i = 0; i < 25; i += 1) await venue(`Club ${i}`);

    const rows = await asUser(a.id, (sql) =>
      sql`SELECT id FROM public.search_venues('club', 'AR', 500)`,
    );
    expect(rows).toHaveLength(20);
  });
});

describe('búsqueda de sedes · visibilidad', () => {
  beforeEach(truncateAll);

  it('la propuesta pendiente de otro no aparece', async () => {
    const a = await createUser();
    const b = await createUser();
    await venue('Club de B', { status: 'pending', submittedBy: b.id });

    expect(await search(a.id, 'club')).toEqual([]);
  });

  it('tu propia propuesta pendiente sí, para poder usarla ya (§13)', async () => {
    const a = await createUser();
    await venue('Mi Club Nuevo', { status: 'pending', submittedBy: a.id });

    expect(await search(a.id, 'club')).toEqual(['Mi Club Nuevo']);
  });

  /** Un moderador ve las pendientes en la moderación, no mezcladas acá. */
  it('un moderador no ve pendientes ajenas en el buscador', async () => {
    const mod = await createUser({ role: 'moderator' });
    const b = await createUser();
    await venue('Club de B', { status: 'pending', submittedBy: b.id });

    expect(await search(mod.id, 'club')).toEqual([]);
  });

  it('sin sesión no se puede buscar', async () => {
    await venue('Top Pádel');
    await expectRejected(asAnon((sql) => sql`SELECT * FROM public.search_venues('top')`));
  });
});

describe('columnas derivadas de la sede', () => {
  beforeEach(truncateAll);

  it('lat y lng salen de la ubicación', async () => {
    const id = await venue('Top Pádel');
    const [row] = await db`SELECT lat, lng FROM public.venues WHERE id = ${id}`;
    expect(row?.lat).toBeCloseTo(-31.42, 5);
    expect(row?.lng).toBeCloseTo(-64.18, 5);
  });

  it('no se pueden escribir a mano', async () => {
    const id = await venue('Top Pádel');
    await expectRejected(db`UPDATE public.venues SET lat = 0 WHERE id = ${id}`);
  });
});
