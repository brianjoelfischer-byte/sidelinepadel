#!/usr/bin/env node
/**
 * Junta todas las migraciones en un solo archivo SQL, listo para pegar en el
 * SQL Editor del dashboard de Supabase.
 *
 * Es la vía sin terminal ni contraseña: útil para aplicar el esquema por
 * primera vez, o desde una máquina sin el repo clonado.
 *
 * NO incluye `supabase/local/` — ese shim emula el esquema `auth` para un
 * Postgres pelado, y en Supabase real ya existe. Aplicarlo allá pisaría cosas.
 *
 *   node scripts/db-bundle.mjs            → supabase/bundle.sql
 *   node scripts/db-bundle.mjs --reset    → agrega el DROP SCHEMA inicial
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(root, 'supabase', 'migrations');
const OUT = join(root, 'supabase', 'bundle.sql');

const reset = process.argv.includes('--reset');

const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

const header = `-- ===========================================================================
--  Sideline Padel · esquema completo
--  Generado por scripts/db-bundle.mjs · ${files.length} migraciones
--
--  Pegá TODO este archivo en el SQL Editor de Supabase y ejecutá.
--  Es una sola transacción: si algo falla, no queda nada a medias.
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

const footer = `
COMMIT;

-- Verificación rápida: debería listar las tablas con RLS activado.
-- SELECT relname, relrowsecurity FROM pg_class c
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY relname;
`;

await writeFile(OUT, header + body.join('\n') + footer, 'utf8');
console.log(`▸ ${OUT}`);
console.log(`▸ ${files.length} migraciones${reset ? ' (con reset)' : ''}`);
