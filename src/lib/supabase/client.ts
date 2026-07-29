'use client';

import { createBrowserClient } from '@supabase/ssr';

import { requireSupabaseConfig } from '@/lib/env';

/**
 * Cliente de Supabase para el navegador.
 *
 * Usa la anon key, que es pública por diseño. Lo único que impide que un
 * usuario lea los datos de otro son las políticas RLS del bloque 2 — no hay
 * ninguna protección adicional del lado del cliente, ni la habría aunque
 * quisiéramos: el código del navegador es inspeccionable.
 */
export function createClient() {
  const config = requireSupabaseConfig();
  return createBrowserClient(config.url, config.anonKey);
}
