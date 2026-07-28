import { z } from 'zod';

/**
 * Acceso a variables de entorno · reglas 19 y 23 del BLUEPRINT.
 *
 * Este es el ÚNICO lugar del código que lee `process.env` (lo hace cumplir
 * una regla de ESLint). Dos motivos:
 *
 *  1. Separa lo público de lo secreto. Todo lo de `serverEnv` lanza si se
 *     lo toca desde el cliente, en vez de terminar silenciosamente dentro
 *     del bundle.
 *  2. Falta una variable → falla al arrancar con un mensaje claro, no con
 *     un `undefined` que aparece tres pantallas más adelante.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),
});

const serverSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

/** Seguro en cualquier lado: solo variables con prefijo NEXT_PUBLIC_. */
export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

let cachedServerEnv: z.infer<typeof serverSchema> | undefined;

/**
 * Solo servidor. Llamarlo desde un Client Component lanza en vez de filtrar.
 *
 * A medida que entren secretos reales (SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET,
 * VAPID_PRIVATE_KEY, IP_PEPPER) van acá y en ningún otro lado.
 */
export function serverEnv() {
  if (typeof window !== 'undefined') {
    throw new Error(
      'serverEnv() se llamó desde el cliente. Las variables del servidor nunca van al bundle.',
    );
  }
  cachedServerEnv ??= serverSchema.parse({ NODE_ENV: process.env.NODE_ENV });
  return cachedServerEnv;
}
