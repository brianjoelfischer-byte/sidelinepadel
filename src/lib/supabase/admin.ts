import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { requireSupabaseConfig, serverEnv } from '@/lib/env';

/**
 * Cliente administrativo. **Se saltea RLS por completo.**
 *
 * Regla 18 del BLUEPRINT: nunca en código que corra para un usuario. Solo en
 * jobs de servidor — despacho de recordatorios, seed de sedes desde Overpass,
 * escritura de `audit_log` e `invite_suppressions`.
 *
 * El import de `server-only` hace que el build FALLE si alguien importa este
 * archivo desde un Client Component, en vez de descubrirlo en producción.
 *
 * Regla práctica: si podés escribir la operación con el cliente normal más una
 * política, hacelo así. Este cliente es para lo que no tiene usuario detrás.
 */
export function createAdminClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv();

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY no está configurada. Solo hace falta para jobs de servidor.',
    );
  }

  return createSupabaseClient(
    requireSupabaseConfig().url,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
