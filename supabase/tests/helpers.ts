import { randomUUID } from 'node:crypto';

import postgres from 'postgres';

/**
 * Utilidades para probar RLS.
 *
 * La idea: en vez de confiar en que las políticas dicen lo correcto, se crean
 * usuarios reales y se intenta leer y escribir lo del otro. Lo que importa no
 * es que la consulta funcione, sino que **no devuelva nada** y que la escritura
 * **falle**.
 *
 * La conexión sale de DATABASE_URL, así que la suite corre igual contra el
 * Postgres del Supabase CLI, contra `scripts/db-local.sh` o contra un proyecto
 * en la nube.
 */
export const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres@127.0.0.1:54322/postgres';

export const db = postgres(DATABASE_URL, { max: 4, onnotice: () => {} });

export type UserRole = 'player' | 'moderator' | 'admin';

export interface TestUser {
  id: string;
  slug: string;
}

let counter = 0;

/** Crea un usuario en auth.users y su perfil. Devuelve el id para actuar como él. */
export async function createUser(
  opts: {
    role?: UserRole;
    isPublic?: boolean;
    declaredLevel?: number;
    effectiveLevel?: number;
  } = {},
): Promise<TestUser> {
  const id = randomUUID();
  const slug = `u${Date.now().toString(36)}-${counter++}`;
  const declared = opts.declaredLevel ?? 4.0;

  await db`INSERT INTO auth.users (id, email) VALUES (${id}, ${slug + '@test.local'})`;
  await db`
    INSERT INTO public.profiles (
      id, display_name, slug, country_code, timezone,
      declared_level, effective_level, birth_date, is_public, role
    ) VALUES (
      ${id}, ${'Test ' + slug}, ${slug}, 'AR', 'America/Argentina/Buenos_Aires',
      ${declared}, ${opts.effectiveLevel ?? declared}, '1990-01-01',
      ${opts.isPublic ?? true}, ${opts.role ?? 'player'}
    )
  `;

  return { id, slug };
}

/**
 * Ejecuta `fn` como si fuera ese usuario: rol `authenticated` y el claim `sub`
 * puesto, que es exactamente lo que hace PostgREST en producción.
 *
 * Va todo en una transacción con `set_config(..., true)` (local a la
 * transacción) para que el claim no se filtre a otra consulta del pool.
 */
export async function asUser<T>(
  userId: string | null,
  fn: (sql: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  const result = await db.begin(async (sql) => {
    const claims = userId
      ? JSON.stringify({ sub: userId, role: 'authenticated' })
      : JSON.stringify({ role: 'anon' });

    await sql`SELECT set_config('request.jwt.claims', ${claims}, true)`;
    await sql.unsafe(`SET LOCAL ROLE ${userId ? 'authenticated' : 'anon'}`);

    return fn(sql);
  });

  // `begin` declara `UnwrapPromiseArray<T>`, que TypeScript no puede probar
  // igual a `T` en un genérico. En runtime lo es: devolvemos lo que devuelve
  // `fn` sin tocarlo.
  return result as T;
}

/** Como visitante sin sesión. */
export function asAnon<T>(
  fn: (sql: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return asUser(null, fn);
}

/**
 * Afirma que una operación es rechazada por la base.
 *
 * Ojo con la diferencia, que es la trampa clásica de testear RLS:
 *   · un INSERT que viola una política LANZA un error
 *   · un SELECT que viola una política NO lanza: devuelve cero filas
 * Por eso las lecturas se prueban contando filas, no esperando excepciones.
 */
export async function expectRejected(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('Se esperaba que la base rechazara la operación, pero funcionó');
}

/** Limpia todo lo creado por los tests. */
export async function truncateAll(): Promise<void> {
  await db.unsafe(`
    TRUNCATE
      public.level_ratings, public.level_history,
      public.session_participants, public.sessions,
      public.match_invitations, public.match_participants, public.match_offers,
      public.reminders, public.push_subscriptions,
      public.profile_achievements, public.abuse_reports, public.audit_log,
      public.follows, public.blocks, public.venues,
      public.profiles
    RESTART IDENTITY CASCADE
  `);
  await db`DELETE FROM auth.users`;
}
