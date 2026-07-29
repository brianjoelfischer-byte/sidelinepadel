#!/usr/bin/env node
/**
 * Genera `src/types/database.ts` introspeccionando la base de DATABASE_URL.
 *
 * El CLI de Supabase hace esto (`supabase gen types`), pero requiere Docker o
 * acceso a la nube. Esto funciona contra cualquier Postgres con el esquema
 * aplicado, que es lo que hace que el proyecto se pueda seguir desde cualquier
 * máquina.
 *
 * Los tipos SIEMPRE se derivan del esquema real: escribirlos a mano garantiza
 * que en algún momento mientan sobre lo que hay en la base.
 *
 *   npm run db:types
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'src', 'types', 'database.ts');

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres@127.0.0.1:54322/postgres';

const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });

/** Postgres → TypeScript. Lo desconocido cae en `unknown`, nunca en `any`. */
function tsType(udt) {
  if (/^(int2|int4|int8|numeric|float4|float8)$/.test(udt)) return 'number';
  if (/^(bool)$/.test(udt)) return 'boolean';
  if (/^(json|jsonb)$/.test(udt)) return 'Json';
  if (/^(text|varchar|bpchar|citext|uuid|date|timestamptz|timestamp|time|bytea)$/.test(udt))
    return 'string';
  if (udt.startsWith('_')) return `${tsType(udt.slice(1))}[]`;
  return 'unknown';
}

/**
 * Une los valores de un CHECK `col IN ('a','b')` en una unión de literales.
 * Es lo que convierte `attendance: string` en algo que el compilador entiende.
 */
function unionFromCheck(definition, column) {
  // Postgres imprime `(col = ANY (ARRAY['a'::text, 'b'::text]))`: el cast va en
  // los valores, no siempre en la columna, y a veces hay paréntesis de más.
  const pattern = new RegExp(
    `\\(?\\b${column}\\b\\)?(?:::text)?\\s*=\\s*ANY\\s*\\(\\s*\\(?ARRAY\\[([^\\]]+)\\]`,
    'i',
  );
  const match = pattern.exec(definition);
  if (!match?.[1]) return null;

  const values = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  return values.length > 0 ? values.map((v) => `'${v}'`).join(' | ') : null;
}

async function main() {
  const columns = await sql`
    SELECT c.table_name, c.column_name, c.udt_name, c.is_nullable,
           c.column_default
    FROM information_schema.columns c
    JOIN pg_class pc ON pc.relname = c.table_name
    JOIN pg_namespace pn ON pn.oid = pc.relnamespace AND pn.nspname = 'public'
    WHERE c.table_schema = 'public'
      AND pc.relkind = 'r'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d WHERE d.objid = pc.oid AND d.deptype = 'e'
      )
    ORDER BY c.table_name, c.ordinal_position
  `;

  const checks = await sql`
    SELECT pc.relname AS table_name, pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con
    JOIN pg_class pc ON pc.oid = con.conrelid
    JOIN pg_namespace pn ON pn.oid = pc.relnamespace AND pn.nspname = 'public'
    WHERE con.contype = 'c'
  `;

  const checksByTable = new Map();
  for (const { table_name, definition } of checks) {
    if (!checksByTable.has(table_name)) checksByTable.set(table_name, []);
    checksByTable.get(table_name).push(definition);
  }

  const tables = new Map();
  for (const col of columns) {
    if (!tables.has(col.table_name)) tables.set(col.table_name, []);
    tables.get(col.table_name).push(col);
  }

  const blocks = [...tables.entries()].map(([table, cols]) => {
    const rows = cols.map((col) => {
      const union = (checksByTable.get(table) ?? [])
        .map((def) => unionFromCheck(def, col.column_name))
        .find(Boolean);

      const base = union ?? tsType(col.udt_name);
      const nullable = col.is_nullable === 'YES';
      return `          ${col.column_name}: ${base}${nullable ? ' | null' : ''};`;
    });

    // En Insert son opcionales las nullables y las que tienen default.
    const inserts = cols.map((col) => {
      const union = (checksByTable.get(table) ?? [])
        .map((def) => unionFromCheck(def, col.column_name))
        .find(Boolean);

      const base = union ?? tsType(col.udt_name);
      const nullable = col.is_nullable === 'YES';
      const optional = nullable || col.column_default !== null;
      return `          ${col.column_name}${optional ? '?' : ''}: ${base}${nullable ? ' | null' : ''};`;
    });

    return `      ${table}: {
        Row: {
${rows.join('\n')}
        };
        Insert: {
${inserts.join('\n')}
        };
        Update: Partial<Database['public']['Tables']['${table}']['Insert']>;
        Relationships: [];
      };`;
  });

  const output = `// GENERADO POR scripts/db-types.mjs — NO EDITAR A MANO.
// Regenerar con \`npm run db:types\` después de cambiar el esquema.
//
// Se deriva del esquema real de la base. Escribir estos tipos a mano
// garantizaría que en algún momento mientan sobre lo que hay en Postgres.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  // supabase-js lo usa para elegir su motor de inferencia de tipos.
  __InternalSupabase: { PostgrestVersion: '13.0.5' };
  public: {
    Tables: {
${blocks.join('\n')}
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
`;

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, output, 'utf8');
  console.log(`▸ ${OUT}`);
  console.log(`▸ ${tables.size} tablas`);
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
