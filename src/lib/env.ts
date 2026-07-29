import { z } from 'zod';

/**
 * Acceso a variables de entorno · reglas 19 y 23 del BLUEPRINT.
 *
 * Este es el ÚNICO lugar del código que lee `process.env` (lo hace cumplir una
 * regla de ESLint), para que un secreto no pueda derivar al bundle del cliente.
 *
 * La validación es PEREZOSA a propósito. Antes lanzaba al importarse, y como el
 * proxy importa este módulo, un `.env.local` faltante tiraba 500 en TODAS las
 * páginas — incluida la landing, que no usa Supabase. Ahora solo falla lo que
 * de verdad necesita la configuración.
 */

const supabaseSchema = z.object({
  url: z.url(),
  anonKey: z.string().min(20),
});

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/**
 * Next sustituye `process.env.NEXT_PUBLIC_*` en tiempo de build, así que hay
 * que nombrarlas literalmente: un acceso dinámico no se reemplaza y llega
 * `undefined` al navegador.
 */
function readSupabaseConfig(): SupabaseConfig | null {
  const parsed = supabaseSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return parsed.success ? parsed.data : null;
}

const isProduction = process.env.NODE_ENV === 'production';

let warned = false;

/** ¿Hay configuración de Supabase? Sirve para degradar sin romper. */
export function hasSupabaseConfig(): boolean {
  return readSupabaseConfig() !== null;
}

/**
 * Configuración de Supabase, o `null` si falta.
 *
 * En producción no devuelve `null`: lanza. Arrancar sin auth en producción
 * sería servir una app donde nadie puede entrar y nada está protegido — mejor
 * que el deploy falle.
 */
export function supabaseConfig(): SupabaseConfig | null {
  const config = readSupabaseConfig();

  if (config) return config;

  if (isProduction) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Sin ellas la app no puede autenticar a nadie.',
    );
  }

  if (!warned) {
    warned = true;
    console.warn(
      '\n  ⚠ Supabase no está configurado.\n' +
        '    La app arranca, pero login y perfil no van a funcionar.\n' +
        '    Copiá .env.example a .env.local y completá los dos valores.\n',
    );
  }

  return null;
}

/**
 * Configuración de Supabase o error. Para código que no puede seguir sin ella.
 */
export function requireSupabaseConfig(): SupabaseConfig {
  const config = supabaseConfig();
  if (!config) {
    throw new Error(
      'Supabase no está configurado. Copiá .env.example a .env.local y completá los valores.',
    );
  }
  return config;
}

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

// --------------------------------------------------------------------------
//  Servidor
// --------------------------------------------------------------------------

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
});

let cachedServerEnv: z.infer<typeof serverSchema> | undefined;

/** Solo servidor. Llamarlo desde el cliente lanza en vez de filtrar. */
export function serverEnv() {
  if (typeof window !== 'undefined') {
    throw new Error(
      'serverEnv() se llamó desde el cliente. Las variables del servidor nunca van al bundle.',
    );
  }
  cachedServerEnv ??= serverSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  return cachedServerEnv;
}
