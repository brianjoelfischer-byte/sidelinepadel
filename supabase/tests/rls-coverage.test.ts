import { describe, expect, it } from 'vitest';

import { asAnon, asUser, createUser, db, truncateAll } from './helpers';

/**
 * Guardas estructurales.
 *
 * Los tests de arriba prueban que las políticas que escribimos hacen lo
 * correcto. Estos prueban algo distinto y más importante: que NO SE PUEDA
 * agregar una tabla sin política. Es la regla 16 del BLUEPRINT convertida en
 * algo que no depende de que nadie se acuerde.
 */
describe('cobertura de RLS', () => {
  it('TODA tabla de public tiene RLS activado y forzado', async () => {
    // Se excluyen las tablas que instala una extensión: `spatial_ref_sys` de
    // PostGIS es un catálogo de sistemas de coordenadas, no un dato nuestro,
    // y no le corresponde RLS. En Supabase real vive en el esquema
    // `extensions`; acá cae en `public` por cómo se instala localmente.
    const rows = await db`
      SELECT c.relname AS table_name, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND NOT EXISTS (
          SELECT 1 FROM pg_depend d
          WHERE d.objid = c.oid AND d.deptype = 'e'
        )
      ORDER BY c.relname
    `;

    expect(rows.length).toBeGreaterThan(10);

    const sinRls = rows
      .filter((r) => !r.relrowsecurity || !r.relforcerowsecurity)
      .map((r) => r.table_name);

    expect(sinRls, 'tablas sin RLS activado y forzado').toEqual([]);
  });

  /**
   * Una tabla con RLS pero sin políticas ni GRANT es inaccesible, que es el
   * default correcto. Pero una tabla con GRANT y sin políticas es un bug:
   * el permiso está dado y nada lo acota.
   */
  it('ninguna tabla tiene GRANT sin políticas que lo acoten', async () => {
    const rows = await db`
      SELECT
        c.relname AS table_name,
        (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies,
        has_table_privilege('authenticated', c.oid, 'SELECT') AS can_select,
        has_table_privilege('authenticated', c.oid, 'INSERT') AS can_insert
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND NOT EXISTS (
          SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e'
        )
      ORDER BY c.relname
    `;

    const expuestas = rows
      .filter((r) => Number(r.policies) === 0 && (r.can_select || r.can_insert))
      .map((r) => r.table_name);

    expect(expuestas, 'tablas con permisos pero sin políticas').toEqual([]);
  });

  /**
   * `audit_log` e `invite_suppressions` son deliberadamente inaccesibles desde
   * la API: las escribe el servidor con service_role. Si alguien les diera un
   * GRANT "para poder leerlas desde el panel", este test lo frena.
   */
  it('las tablas internas no se exponen a la API', async () => {
    for (const table of ['audit_log', 'invite_suppressions']) {
      const rows = await db`
        SELECT
          has_table_privilege('authenticated', ${'public.' + table}, 'SELECT') AS sel,
          has_table_privilege('anon', ${'public.' + table}, 'SELECT') AS anon_sel
      `;
      expect(rows[0]?.sel, `${table} no debe ser legible por authenticated`).toBe(false);
      expect(rows[0]?.anon_sel, `${table} no debe ser legible por anon`).toBe(false);
    }
  });

  /**
   * La vista materializada `played_with` no soporta RLS, así que se protege
   * quitándole el acceso a los roles de la API. Si alguien la expone, cualquiera
   * podría leer con quién juega cualquier otro.
   */
  it('played_with no es accesible directamente', async () => {
    const [row] = await db`
      SELECT has_table_privilege('authenticated', 'public.played_with', 'SELECT') AS sel
    `;
    expect(row?.sel).toBe(false);
  });

  /**
   * Toda función SECURITY DEFINER tiene que fijar su search_path. Sin eso, un
   * search_path manipulado puede hacer que la función resuelva una tabla del
   * atacante en lugar de la nuestra — y como corre con los permisos del dueño,
   * es escalada de privilegios.
   */
  it('toda función SECURITY DEFINER fija search_path', async () => {
    const rows = await db`
      SELECT n.nspname || '.' || p.proname AS fn
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname IN ('public', 'app')
        AND p.prosecdef
        AND NOT EXISTS (
          SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) cfg
          WHERE cfg LIKE 'search_path=%'
        )
    `;
    expect(rows.map((r) => r.fn), 'SECURITY DEFINER sin search_path fijo').toEqual([]);
  });
});

/**
 * Cuántas filas ve un visitante sin sesión. Devuelve 0 tanto si la política
 * lo filtra como si le falta el GRANT — las dos son "no ve nada".
 */
async function countAsAnon(table: string): Promise<number> {
  try {
    const rows = await asAnon((sql) => sql.unsafe(`SELECT id FROM ${table}`));
    return rows.length;
  } catch (error) {
    if (error instanceof Error && /permission denied/i.test(error.message)) {
      return 0;
    }
    throw error;
  }
}

describe('anon no puede escribir nada', () => {
  it('un visitante sin sesión no tiene permiso de escritura en ninguna tabla', async () => {
    const rows = await db`
      SELECT c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND (
          has_table_privilege('anon', c.oid, 'INSERT') OR
          has_table_privilege('anon', c.oid, 'UPDATE') OR
          has_table_privilege('anon', c.oid, 'DELETE')
        )
    `;
    expect(rows.map((r) => r.table_name), 'anon con permisos de escritura').toEqual([]);
  });

  /**
   * `anon` ni siquiera tiene GRANT sobre estas tablas, así que la base corta
   * antes de evaluar la política: "permission denied" en vez de cero filas.
   * Es el resultado más fuerte de los dos, así que se aceptan ambos.
   */
  it('un visitante no ve sesiones de nadie', async () => {
    await truncateAll();
    const a = await createUser();
    await db`
      INSERT INTO public.sessions (owner_id, kind, played_on, result)
      VALUES (${a.id}, 'match', current_date, 'win')
    `;

    expect(await countAsAnon('public.sessions')).toBe(0);
  });

  it('un visitante no ve turnos', async () => {
    await truncateAll();
    const a = await createUser();
    await db`
      INSERT INTO public.match_offers (
        creator_id, starts_at, timezone, level_min, level_max, spots_open, guests_count
      ) VALUES (${a.id}, now() + interval '1 day', 'UTC', 3.0, 5.0, 3, 0)
    `;

    expect(await countAsAnon('public.match_offers')).toBe(0);
  });
});

describe('sedes', () => {
  it('las sedes aprobadas son públicas; las pendientes no', async () => {
    await truncateAll();
    const a = await createUser();
    const b = await createUser();

    const [aprobada] = await db`
      INSERT INTO public.venues (name, country_code, location, timezone, source, status)
      VALUES ('Club Aprobado', 'AR', ST_MakePoint(-58.4, -34.6)::geography,
              'America/Argentina/Buenos_Aires', 'import', 'approved')
      RETURNING id
    `;
    const [pendiente] = await db`
      INSERT INTO public.venues (name, country_code, location, timezone, source, status, submitted_by)
      VALUES ('Club Pendiente', 'AR', ST_MakePoint(-58.5, -34.7)::geography,
              'America/Argentina/Buenos_Aires', 'user', 'pending', ${a.id})
      RETURNING id
    `;

    const vistas = await asUser(b.id, (sql) => sql`SELECT id FROM public.venues`);
    const ids = vistas.map((r) => r.id);

    expect(ids).toContain(aprobada!.id);
    expect(ids).not.toContain(pendiente!.id);

    // Quien la propuso sí ve la suya mientras espera moderación.
    const propias = await asUser(a.id, (sql) =>
      sql`SELECT id FROM public.venues WHERE id = ${pendiente!.id}`,
    );
    expect(propias).toHaveLength(1);
  });

  it('un usuario NO puede autoaprobar una sede', async () => {
    await truncateAll();
    const a = await createUser();

    let failed = false;
    try {
      await asUser(a.id, (sql) =>
        sql`
          INSERT INTO public.venues (name, country_code, location, timezone, source, status, submitted_by)
          VALUES ('Truchada', 'AR', ST_MakePoint(0, 0)::geography, 'UTC',
                  'user', 'approved', ${a.id})
        `,
      );
    } catch {
      failed = true;
    }
    expect(failed, 'debería rechazar status=approved').toBe(true);
  });

  it('la búsqueda por cercanía solo devuelve aprobadas', async () => {
    await truncateAll();
    const a = await createUser();

    await db`
      INSERT INTO public.venues (name, country_code, location, timezone, source, status)
      VALUES ('Cerca Aprobada', 'AR', ST_MakePoint(-58.40, -34.60)::geography, 'UTC', 'import', 'approved'),
             ('Cerca Pendiente', 'AR', ST_MakePoint(-58.41, -34.61)::geography, 'UTC', 'user', 'pending')
    `;

    const rows = await asUser(a.id, (sql) =>
      sql`SELECT name FROM public.venues_nearby(-34.60, -58.40, 25000)`,
    );
    const names = rows.map((r) => r.name);

    expect(names).toContain('Cerca Aprobada');
    expect(names).not.toContain('Cerca Pendiente');
  });
});
