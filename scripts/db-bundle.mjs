#!/usr/bin/env node
/**
 * Junta migraciones en un solo archivo SQL, listo para pegar en el SQL Editor
 * del dashboard de Supabase.
 *
 * Es la vía sin terminal ni contraseña: útil para aplicar el esquema por
 * primera vez, o desde una máquina sin el repo clonado.
 *
 * NO incluye `supabase/local/` — ese shim emula el esquema `auth` para un
 * Postgres pelado, y en Supabase real ya existe. Aplicarlo allá pisaría cosas.
 *
 *   node scripts/db-bundle.mjs                    → todas (base vacía)
 *   node scripts/db-bundle.mjs --pending          → solo las que falten (*)
 *   node scripts/db-bundle.mjs --from 20260729    → de esa en adelante
 *   node scripts/db-bundle.mjs --reset            → agrega el DROP SCHEMA inicial
 *
 * (*) `--pending` necesita DATABASE_URL apuntando a la base destino. Sin eso,
 * usá `--from` con el nombre de la primera que te falte.
 *
 * ## Por qué existe `--from`
 *
 * Las migraciones NO son idempotentes: `CREATE TABLE profiles` falla con
 * "already exists" si ya corriste el lote anterior. El bundle completo sirve
 * para una base vacía; sobre una base a medio camino hay que mandar solo el
 * tramo que falta.
 *
 * Para no tener que recordarlo, el bundle deja registro en
 * `app.schema_migrations`. Consultá qué se aplicó con:
 *
 *   SELECT filename, applied_at FROM app.schema_migrations ORDER BY filename;
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(root, 'supabase', 'migrations');
const OUT = join(root, 'supabase', 'bundle.sql');

const argv = process.argv.slice(2);
const reset = argv.includes('--reset');
const pending = argv.includes('--pending');

/** `--from 20260729` o `--from=20260729`. Compara por prefijo de nombre. */
function readFrom() {
  const inline = argv.find((a) => a.startsWith('--from='));
  if (inline) return inline.slice('--from='.length);
  const i = argv.indexOf('--from');
  return i !== -1 ? argv[i + 1] : undefined;
}
const from = readFrom();

const all = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
if (all.length === 0) throw new Error('No hay migraciones en supabase/migrations');

/**
 * Consulta el registro en la base destino y devuelve lo no aplicado.
 * Si la tabla no existe todavía, la base está virgen: van todas.
 */
async function pendingFiles() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('✗ --pending necesita DATABASE_URL apuntando a la base destino.');
    console.error('  Sin eso, usá --from con el nombre de la primera que falte.');
    process.exit(1);
  }
  const { default: postgres } = await import('postgres');
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const [row] = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'app' AND table_name = 'schema_migrations'
      ) AS present
    `;
    if (!row.present) return all;
    const rows = await sql`SELECT filename FROM app.schema_migrations`;
    const applied = new Set(rows.map((r) => r.filename));
    return all.filter((f) => !applied.has(f));
  } finally {
    await sql.end();
  }
}

let files;
if (pending) {
  files = await pendingFiles();
} else if (from) {
  files = all.filter((f) => f >= from);
  if (files.length === 0) {
    console.error(`✗ Ninguna migración coincide con --from ${from}.`);
    console.error(`  La primera es ${all[0]}.`);
    process.exit(1);
  }
} else {
  files = all;
}

if (files.length === 0) {
  console.log('▸ No hay migraciones pendientes: la base está al día.');
  process.exit(0);
}

const partial = files.length < all.length;

const header = `-- ===========================================================================
--  Sideline Padel · ${partial ? `migraciones pendientes (${files.length} de ${all.length})` : 'esquema completo'}
--  Generado por scripts/db-bundle.mjs
--
--  Pegá TODO este archivo en el SQL Editor de Supabase y ejecutá.
--  Es una sola transacción: si algo falla, no queda nada a medias.
${
  partial
    ? `--
--  Contiene SOLO desde ${files[0]}.
--  Las anteriores se dan por aplicadas.`
    : `--
--  Contiene TODAS las migraciones: es para una base vacía. Sobre una base
--  que ya tiene tablas va a fallar con "already exists" — en ese caso usá
--  \`npm run db:bundle -- --from <migracion>\`.`
}
-- ===========================================================================

BEGIN;
${
  reset
    ? `
-- Reset pedido explícitamente: borra el esquema y lo vuelve a crear.
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS app CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO PUBLIC;
`
    : ''
}`;

const body = await Promise.all(
  files.map(async (file) => {
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    return `
-- ---------------------------------------------------------------------------
-- ${file}
-- ---------------------------------------------------------------------------
${sql.trim()}
`;
  }),
);

/**
 * El registro se escribe al final: el esquema `app` lo crea la primera
 * migración, así que antes de ese punto no existe dónde guardarlo.
 *
 * Se marcan como aplicadas TODAS las anteriores a este lote, no solo las que
 * van acá: si estás mandando desde la quinta, las cuatro primeras ya están en
 * la base — por eso te hizo falta el `--from`.
 */
const ledger = `
-- ---------------------------------------------------------------------------
-- Registro de migraciones aplicadas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.schema_migrations (
  filename   text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.schema_migrations (filename) VALUES
${all
  .filter((f) => f <= files[files.length - 1])
  .map((f) => `  ('${f}')`)
  .join(',\n')}
ON CONFLICT (filename) DO NOTHING;
`;

const footer = `
COMMIT;

-- Verificación: qué migraciones quedaron registradas.
-- SELECT filename, applied_at FROM app.schema_migrations ORDER BY filename;

-- Verificación: las tablas con RLS activado.
-- SELECT relname, relrowsecurity FROM pg_class c
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY relname;
`;

await writeFile(OUT, header + body.join('\n') + ledger + footer, 'utf8');
console.log(`▸ ${OUT}`);
console.log(
  `▸ ${files.length} ${files.length === 1 ? 'migración' : 'migraciones'}` +
    `${partial ? ` (desde ${files[0]})` : ''}${reset ? ' · con reset' : ''}`,
);
