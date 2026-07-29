#!/usr/bin/env node
/**
 * Corre antes de `npm run dev`.
 *
 * Existe porque `.env.local` está en .gitignore: quien clona el repo no lo
 * tiene, y descubrirlo por un error en el navegador es la peor forma posible.
 * Acá se crea solo y se dice exactamente qué falta completar.
 */
import { copyFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL = join(root, '.env.local');
const EXAMPLE = join(root, '.env.example');

const dim = (s) => `[2m${s}[0m`;
const bold = (s) => `[1m${s}[0m`;
const amber = (s) => `[33m${s}[0m`;

if (!existsSync(LOCAL)) {
  await copyFile(EXAMPLE, LOCAL);
  console.log(`\n  ${bold('Creé .env.local')} a partir de .env.example.\n`);
}

const content = await readFile(LOCAL, 'utf8');

/** Variables sin valor: `NOMBRE=` al final de línea, ignorando comentarios. */
const missing = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'].filter(
  (name) => {
    const match = new RegExp(`^${name}=(.*)$`, 'm').exec(content);
    const value = match?.[1]?.trim() ?? '';
    return value === '' || value.includes('tu-proyecto');
  },
);

if (missing.length > 0) {
  console.log(amber('  ⚠ Supabase no está configurado todavía.\n'));
  console.log('  Falta completar en .env.local:');
  for (const name of missing) console.log(`    · ${name}`);
  console.log(
    dim('\n  Los sacás de tu proyecto en Supabase → Project Settings → API.'),
  );
  console.log(
    dim('  La app arranca igual, pero login y perfil no van a funcionar.\n'),
  );
}
