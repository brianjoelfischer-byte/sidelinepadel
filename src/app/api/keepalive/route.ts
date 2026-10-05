import { createClient } from '@supabase/supabase-js';

import { serverEnv, supabaseConfig } from '@/lib/env';

/**
 * Latido diario para que Supabase no pause el proyecto.
 *
 * El plan gratis pausa los proyectos que pasan 7 días sin actividad, y con
 * pocos usuarios eso pasa. Vercel llama a esta ruta una vez por día (ver
 * `vercel.json`) y acá se hace una consulta mínima a la base: contar una
 * sede, con la clave pública, lo mismo que puede hacer cualquier visitante.
 *
 * Si está configurado `CRON_SECRET` en Vercel, Vercel lo manda en la
 * cabecera y solo esa llamada pasa. Sin él la ruta queda abierta, que no es
 * un riesgo: no devuelve datos y la consulta es la más barata posible.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = serverEnv().CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const config = supabaseConfig();
  if (!config) return Response.json({ ok: false, error: 'not_configured' }, { status: 503 });

  const supabase = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase
    .from('venues')
    .select('id', { count: 'exact', head: true })
    .limit(1);

  if (error) return Response.json({ ok: false, error: 'db' }, { status: 502 });
  return Response.json({ ok: true, at: new Date().toISOString() });
}
