import { z } from 'zod';

/**
 * Acceso a variables de entorno · reglas 19 y 23 del BLUEPRINT.
 *
 * Este es el ÚNICO lugar del código que lee `process.env` (lo hace cumplir
 * una regla de ESLint). Dos motivos:
 *
 *  1. Separa lo público de lo secreto. Todo lo de `serverEnv()` lanza si se
 *     lo toca desde el cliente, en vez de terminar silenciosamente dentro
 *     del bundle.
 *  2. Falta una variable → falla al arrancar con un mensaje claro, no con
 *     un `undefined` que aparece tres pantallas más adelante.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
});

/**
 * Seguro en cualquier lado: solo variables con prefijo NEXT_PUBLIC_.
 *
 * Next reemplaza `process.env.NEXT_PUBLIC_*` en tiempo de build, así que hay
 * que nombrarlas una por una — un acceso dinámico no se sustituye y llega
 * `undefined` al navegador.
 */
const parsedClient = clientSchema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!parsedClient.success) {
  const missing = parsedClient.error.issues
    .map((issue) => issue.path.join('.'))
    .join(', ');
  throw new Error(
    `Faltan variables de entorno: ${missing}. ` +
      'Copiá .env.example a .env.local y completá los valores de Supabase.',
  );
}

export const clientEnv = parsedClient.data;

let cachedServerEnv: z.infer<typeof serverSchema> | undefined;

/**
 * Solo servidor. Llamarlo desde un Client Component lanza en vez de filtrar.
 */
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
