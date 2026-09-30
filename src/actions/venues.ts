'use server';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

/**
 * Clubes: buscar, detectar si ya existe, agregar.
 *
 * Sin `getUser()` a propósito: todas llaman a funciones de la base que solo
 * se pueden ejecutar con sesión iniciada, así que sin sesión la base las
 * rechaza y esto devuelve vacío o un error. Validar además acá sumaría un
 * viaje al servidor de auth por cada tecla del buscador.
 *
 * El país solo ordena la búsqueda, no filtra: un argentino que jugó en Madrid
 * tiene que poder encontrar el club.
 */

export interface VenueOption {
  id: string;
  name: string;
  city: string | null;
  adminArea: string | null;
  countryCode: string;
  courts: number | null;
  /** Verificado: de OpenStreetMap, o confirmado por 3 jugadores. */
  verified: boolean;
  /** Jugadores distintos que cargaron partidos ahí. */
  players: number;
}

const country = z.string().regex(/^[A-Z]{2}$/);

// ---------------------------------------------------------------------------
//  Buscar
// ---------------------------------------------------------------------------
const searchSchema = z.object({
  q: z.string().trim().min(2).max(80),
  country: country.optional(),
});

export async function searchVenues(input: unknown): Promise<VenueOption[]> {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('search_venues', {
    q: parsed.data.q,
    max_results: 8,
    ...(parsed.data.country ? { prefer_country: parsed.data.country } : {}),
  });
  if (error || !data) return [];

  return data.flatMap((row) =>
    row.id && row.name && row.country_code
      ? [
          {
            id: row.id,
            name: row.name,
            city: row.city,
            adminArea: row.admin_area,
            countryCode: row.country_code,
            courts: row.courts_count,
            verified: row.verified ?? false,
            players: row.players_count ?? 0,
          },
        ]
      : [],
  );
}

// ---------------------------------------------------------------------------
//  ¿Ya existe?
// ---------------------------------------------------------------------------
const draftSchema = z.object({
  name: z.string().trim().min(2).max(120),
  country,
  adminArea: z.string().trim().max(80).optional(),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().max(160).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export type VenueDraft = z.infer<typeof draftSchema>;

export interface SimilarVenue {
  id: string;
  name: string;
  city: string | null;
  adminArea: string | null;
  verified: boolean;
  players: number;
  /** Mismo nombre, sin contar tildes ni palabras como "Club" o "Pádel". */
  sameName: boolean;
}

export async function findSimilarVenues(input: unknown): Promise<SimilarVenue[]> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return [];
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('similar_venues', {
    p_name: d.name,
    p_country: d.country,
    p_city: d.city,
    ...(d.adminArea ? { p_admin_area: d.adminArea } : {}),
    ...(d.lat !== undefined && d.lng !== undefined ? { p_lat: d.lat, p_lng: d.lng } : {}),
  });
  if (error || !data) return [];

  return data.flatMap((row) =>
    row.id && row.name
      ? [
          {
            id: row.id,
            name: row.name,
            city: row.city,
            adminArea: row.admin_area,
            verified: row.verified ?? false,
            players: row.players_count ?? 0,
            sameName: row.same_name ?? false,
          },
        ]
      : [],
  );
}

// ---------------------------------------------------------------------------
//  Agregar
// ---------------------------------------------------------------------------
export type SubmitVenueResult =
  | { ok: true; id: string; created: boolean }
  | { ok: false; error: 'invalid' | 'unavailable' };

export async function submitVenue(input: unknown): Promise<SubmitVenueResult> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_venue', {
    p_name: d.name,
    p_country: d.country,
    p_admin_area: d.adminArea ?? '',
    p_city: d.city,
    ...(d.address ? { p_address: d.address } : {}),
    ...(d.lat !== undefined && d.lng !== undefined ? { p_lat: d.lat, p_lng: d.lng } : {}),
  });

  const row = data?.[0];
  if (error || !row?.id) return { ok: false, error: 'unavailable' };
  // `created: false` es que ya existía: la base devolvió ese en vez de
  // duplicarlo. Para quien lo agrega es un éxito igual.
  return { ok: true, id: row.id, created: row.created ?? false };
}

// ---------------------------------------------------------------------------
//  Ciudades conocidas de una provincia
// ---------------------------------------------------------------------------
const citiesSchema = z.object({
  country,
  adminArea: z.string().trim().max(80).optional(),
});

export async function knownCities(input: unknown): Promise<string[]> {
  const parsed = citiesSchema.safeParse(input);
  if (!parsed.success) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('venue_cities', {
    p_country: parsed.data.country,
    ...(parsed.data.adminArea ? { p_admin_area: parsed.data.adminArea } : {}),
  });
  if (error || !data) return [];
  return data.flatMap((row) => (row.city ? [row.city] : []));
}
