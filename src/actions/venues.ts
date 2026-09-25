'use server';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

/**
 * Búsqueda de sedes para el campo "Dónde jugaste".
 *
 * Sin `getUser()` a propósito: se llama con cada tecla (con pausa), y
 * validar la sesión contra el servidor de auth sumaría un viaje por letra. No
 * hace falta: `search_venues` solo se puede ejecutar con sesión iniciada, así
 * que sin sesión la base la rechaza y esto devuelve una lista vacía.
 *
 * El país solo ordena, no filtra: un argentino que jugó en Madrid tiene que
 * poder encontrar el club. Por eso se acepta del cliente sin más.
 */

export interface VenueOption {
  id: string;
  name: string;
  city: string | null;
  countryCode: string;
  courts: number | null;
}

const inputSchema = z.object({
  q: z.string().trim().min(2).max(80),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
});

export async function searchVenues(input: unknown): Promise<VenueOption[]> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return [];

  const { q, country } = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('search_venues', {
    q,
    max_results: 8,
    ...(country ? { prefer_country: country } : {}),
  });

  if (error || !data) return [];

  return data.flatMap((row) =>
    row.id && row.name && row.country_code
      ? [
          {
            id: row.id,
            name: row.name,
            city: row.city,
            countryCode: row.country_code,
            courts: row.courts_count,
          },
        ]
      : [],
  );
}
