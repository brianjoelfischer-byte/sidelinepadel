import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { requireSupabaseConfig } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Cliente de Supabase para Server Components y Server Actions.
 *
 * Lee la sesión de las cookies, así que las consultas corren como el usuario
 * autenticado y RLS se aplica igual que en el navegador. Sigue usando la anon
 * key: el privilegio sale del JWT del usuario, no de la clave.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const config = requireSupabaseConfig();

  return createServerClient<Database>(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Un Server Component no puede escribir cookies. El refresco de
            // sesión lo hace el proxy, así que acá se ignora sin romper nada.
          }
        },
      },
    },
  );
}
