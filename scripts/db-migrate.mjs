#!/usr/bin/env node
/**
 * Aplica el esquema a la base que apunte DATABASE_URL.
 *
 * Deliberadamente agnóstico del origen de la base: funciona igual contra el
 * Postgres del Supabase CLI, contra `scripts/db-local.sh`, o contra un
 * proyecto Supabase en la nube. Eso es lo que hace que el proyecto se pueda
 * seguir desde cualquier máquina.
 *
 * Uso:
 *   node scripts/db-migrate.mjs           # aplica lo que falte
 *   node scripts/db-migrate.mjs --reset   # borra el esquema y reaplica todo
 *
 * El shim de `supabase/local/` se aplica SOLO si la base no tiene ya el
 * esquema `auth` — es decir, nunca contra Supabase real.
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(root, 'supabase', 'migrations');
const LOCAL_DIR = join(root, 'supabase', 'local');

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres@127.0.0.1:54322/postgres';

const reset = process.argv.includes('--reset');
const quiet = process.argv.includes('--quiet');

const log = (...args) => {
  if (!quiet) console.log(...args);
};

const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });

async function hasAuthSchema() {
  const [row] = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth'
    ) AS present
  `;
  return row.present;
}

async function applyFile(path, name) {
  const body = await readFile(path, 'utf8');
  try {
    await sql.unsafe(body);
    log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.message}`);
    if (error.position) console.error(`    posición ${error.position}`);
    throw error;
  }
}

async function main() {
  log(`▸ Base: ${DATABASE_URL.replace(/:[^:@/]*@/, ':***@')}`);

  if (reset) {
    log('▸ Reset: borrando esquemas public y app');
    await sql.unsafe(`
      DROP SCHEMA IF EXISTS public CASCADE;
      DROP SCHEMA IF EXISTS app CASCADE;
      CREATE SCHEMA public;
      GRANT USAGE ON SCHEMA public TO PUBLIC;
    `);
  }

  // El shim solo existe para Postgres pelado. Contra Supabase real, el
  // esquema `auth` ya está y no lo tocamos.
  if (!(await hasAuthSchema())) {
    log('▸ Sin esquema `auth`: aplicando shim de Supabase (solo local)');
    const shims = (await readdir(LOCAL_DIR)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of shims) {
      await applyFile(join(LOCAL_DIR, file), `local/${file}`);
    }
  } else {
    log('▸ Esquema `auth` presente: se omite el shim');
  }

  log('▸ Aplicando migraciones');
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) throw new Error('No hay migraciones en supabase/migrations');

  for (const file of files) {
    await applyFile(join(MIGRATIONS_DIR, file), file);
  }

  log(`▸ Listo · ${files.length} migraciones`);
}

try {
  await main();
} catch {
  process.exitCode = 1;
} finally {
  await sql.end();
}
