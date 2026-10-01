-- ===========================================================================
--  13 · Clubes agregados por jugadores, sin duplicados · §13
-- ===========================================================================
--
-- OpenStreetMap tiene 346 clubes de Argentina; hay miles. La fuente principal
-- van a ser los propios jugadores, y con muchos jugadores el riesgo es obvio:
-- "Club Alemán", "Club Aleman Padel" y "Padel Club Alemán" como tres clubes.
--
-- Tres defensas, de la más fuerte a la más blanda:
--
--  1. Nombre núcleo. Se sacan tildes, mayúsculas, signos y las palabras de
--     relleno (club, pádel, complejo, centro, deportivo, de, la…). Los tres
--     nombres de arriba quedan en "aleman". Mismo núcleo en la misma ciudad =
--     mismo club: `submit_venue` devuelve el existente en vez de crear otro, y
--     un índice único lo garantiza aunque dos personas lo agreguen a la vez.
--
--  2. Parecido (trigramas). "Raquete" y "Raquette" no tienen el mismo núcleo
--     pero se parecen en un 0,7. `similar_venues` los ofrece como "¿es alguno
--     de estos?" antes de crear. Nunca une solo: "aleman" y "alemania" también
--     se parecen en un 0,6, y pueden ser clubes distintos.
--
--  3. Provincia. Si la ciudad se escribió distinto ("Córdoba Capital" vs
--     "Córdoba"), la misma provincia con un nombre casi igual alcanza para
--     preguntar.
--
-- Y un club agregado aparece enseguida en el buscador de todos, marcado como
-- agregado por jugadores. Cuando 3 jugadores distintos cargan partidos ahí,
-- se verifica solo: con miles de clubes, esperar a un moderador no escala.

-- ---------------------------------------------------------------------------
--  pg_trgm, en el esquema `extensions` y siempre llamado con ese prefijo.
--  Supabase instala las extensiones ahí; un Postgres local no tiene el
--  esquema, así que se crea. Con el prefijo explícito, la misma función anda
--  en los dos lados (la migración 12 evitó `unaccent` justamente por esto).
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
--  Nombre núcleo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.venue_core_name(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT coalesce(
    nullif(
      btrim(regexp_replace(
        regexp_replace(
          -- signos a espacio: "L'Arena" y "L Arena" tienen que dar lo mismo
          regexp_replace(app.fold(t), '[^a-z0-9 ]', ' ', 'g'),
          '\m(club|clubes|padel|paddle|complejo|centro|deportivo|deportiva|polideportivo|sport|sports|social|el|la|los|las|de|del|y|the|and)\M',
          ' ', 'g'),
        '\s+', ' ', 'g')),
      ''),
    -- Si el nombre era solo relleno ("Club de Pádel"), queda entero: un
    -- núcleo vacío haría iguales a todos los clubes así llamados.
    app.fold(t)
  )
$$;

-- ---------------------------------------------------------------------------
--  Columnas
-- ---------------------------------------------------------------------------

-- Un club agregado por un jugador puede no tener ubicación exacta: con
-- provincia y ciudad ya se busca y se deduplica. Los de OpenStreetMap la
-- tienen siempre.
ALTER TABLE public.venues ALTER COLUMN location DROP NOT NULL;
ALTER TABLE public.venues
  ADD CONSTRAINT venues_osm_location CHECK (source <> 'osm' OR location IS NOT NULL);

-- El de un jugador trae ciudad siempre: sin ciudad no hay cómo deduplicar.
ALTER TABLE public.venues
  ADD CONSTRAINT venues_user_city CHECK (
    source <> 'user' OR (city IS NOT NULL AND char_length(btrim(city)) >= 2)
  );

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS core_name text
    GENERATED ALWAYS AS (app.venue_core_name(name)) STORED,
  ADD COLUMN IF NOT EXISTS city_key text
    GENERATED ALWAYS AS (app.fold(coalesce(city, ''))) STORED,
  -- Jugadores distintos que cargaron partidos acá. Lo mantiene un trigger;
  -- nadie lo escribe a mano (ver la política de alta más abajo).
  ADD COLUMN IF NOT EXISTS players_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS venues_dedupe_idx
  ON public.venues (country_code, city_key, core_name);
CREATE INDEX IF NOT EXISTS venues_area_idx
  ON public.venues (country_code, admin_area);

-- La garantía de fondo: dos altas de jugadores con el mismo núcleo en la
-- misma ciudad no pueden convivir, aunque lleguen en el mismo milisegundo.
-- Solo entre altas de jugadores: OpenStreetMap puede tener dos sucursales
-- con el mismo nombre, y eso no se toca.
CREATE UNIQUE INDEX IF NOT EXISTS venues_user_unique
  ON public.venues (country_code, city_key, core_name)
  WHERE source = 'user' AND status IN ('pending', 'approved');

-- ---------------------------------------------------------------------------
--  RLS
-- ---------------------------------------------------------------------------

-- Los agregados por jugadores (pendientes) los ve cualquiera con sesión, para
-- que el segundo que lo busca lo encuentre. Sin sesión, solo verificados.
-- Rechazados y duplicados, nunca.
DROP POLICY IF EXISTS venues_select ON public.venues;
CREATE POLICY venues_select ON public.venues
  FOR SELECT TO anon, authenticated
  USING (
    status = 'approved'
    OR (status = 'pending' AND auth.uid() IS NOT NULL)
    OR submitted_by = auth.uid()
    OR app.is_moderator()
  );

-- El alta de un jugador, además de lo de antes, nace con el contador en 0:
-- si no, se podría crear un club "usado por 99 jugadores".
DROP POLICY IF EXISTS venues_insert ON public.venues;
CREATE POLICY venues_insert ON public.venues
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND status = 'pending'
    AND source = 'user'
    AND approved_by IS NULL
    AND players_count = 0
  );

-- ---------------------------------------------------------------------------
--  Contador de jugadores y verificación comunitaria
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.refresh_venue_players()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  touched uuid[] := ARRAY[]::uuid[];
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.venue_id IS NOT NULL THEN
    touched := touched || NEW.venue_id;
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.venue_id IS NOT NULL THEN
    touched := touched || OLD.venue_id;
  END IF;
  IF cardinality(touched) = 0 THEN
    RETURN NULL;
  END IF;

  -- Se recuenta desde las sesiones, no se suma uno: así un borrado resta y
  -- el mismo jugador cargando diez partidos cuenta una vez.
  UPDATE public.venues v
     SET players_count = (
           SELECT count(DISTINCT s.owner_id)
           FROM public.sessions s
           WHERE s.venue_id = v.id
         )
   WHERE v.id = ANY (touched);

  -- Tres jugadores distintos jugaron ahí: es un club real. Solo sube de
  -- pendiente a aprobado, nunca revierte un rechazo de un moderador.
  UPDATE public.venues v
     SET status = 'approved'
   WHERE v.id = ANY (touched)
     AND v.source = 'user'
     AND v.status = 'pending'
     AND v.players_count >= 3;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sessions_venue_players ON public.sessions;
CREATE TRIGGER sessions_venue_players
  AFTER INSERT OR UPDATE OF venue_id OR DELETE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION app.refresh_venue_players();

-- ---------------------------------------------------------------------------
--  Búsqueda: ahora incluye los agregados por jugadores, y dice cuáles son
--  verificados y cuántos jugadores los usan. Cambia lo que devuelve, así que
--  hay que borrarla antes (CREATE OR REPLACE no cambia el tipo de retorno).
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.search_venues(text, text, integer);
CREATE FUNCTION public.search_venues(
  q text,
  prefer_country text DEFAULT NULL,
  max_results integer DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  name text,
  city text,
  admin_area text,
  address text,
  country_code text,
  courts_count integer,
  lat double precision,
  lng double precision,
  verified boolean,
  players_count integer
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH words AS (
    SELECT coalesce(array_agg(
             replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_')
           ), '{}') AS ws
    FROM unnest(string_to_array(app.fold(coalesce(q, '')), ' ')) AS w
    WHERE w <> ''
  )
  SELECT v.id, v.name, v.city, v.admin_area, v.address,
         v.country_code::text, v.courts_count, v.lat, v.lng,
         v.status = 'approved', v.players_count
  FROM public.venues v, words
  WHERE char_length(app.fold(coalesce(q, ''))) >= 2
    AND v.status IN ('approved', 'pending')
    AND NOT EXISTS (
      SELECT 1 FROM unnest(words.ws) AS w
      WHERE v.search_text || ' ' || app.fold(coalesce(v.admin_area, ''))
            NOT LIKE '%' || w || '%'
    )
  ORDER BY
    (v.country_code = upper(prefer_country)) DESC NULLS LAST,
    (app.fold(v.name) LIKE words.ws[1] || '%') DESC,
    (v.status = 'approved') DESC,
    v.players_count DESC,
    v.name
  LIMIT least(greatest(coalesce(max_results, 8), 1), 20)
$$;

REVOKE ALL ON FUNCTION public.search_venues(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_venues(text, text, integer) TO authenticated;

-- ---------------------------------------------------------------------------
--  ¿Ya existe? Candidatos antes de crear.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.similar_venues(
  p_name text,
  p_country text,
  p_admin_area text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  city text,
  admin_area text,
  verified boolean,
  players_count integer,
  same_name boolean,
  score real
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH q AS (
    SELECT app.venue_core_name(coalesce(p_name, '')) AS core,
           app.fold(coalesce(p_city, '')) AS city_key,
           app.fold(coalesce(p_admin_area, '')) AS area_key,
           CASE WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
                THEN ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
           END AS pt
  )
  SELECT v.id, v.name, v.city, v.admin_area,
         v.status = 'approved', v.players_count,
         v.core_name = q.core,
         extensions.similarity(v.core_name, q.core)
  FROM public.venues v, q
  WHERE v.country_code = upper(p_country)
    AND v.status IN ('approved', 'pending')
    AND char_length(q.core) >= 2
    AND (
      -- Mismo lugar: misma ciudad, o a menos de 2 km si hay ubicación…
      (
        ((q.city_key <> '' AND v.city_key = q.city_key)
          OR (q.pt IS NOT NULL AND v.location IS NOT NULL
              AND ST_DWithin(v.location, q.pt, 2000)))
        AND (
          v.core_name = q.core
          OR extensions.similarity(v.core_name, q.core) >= 0.45
          -- "aleman" dentro de "aleman norte": sucursal o nombre largo
          OR (char_length(q.core) >= 4 AND v.core_name LIKE '%' || q.core || '%')
          OR (char_length(v.core_name) >= 4 AND q.core LIKE '%' || v.core_name || '%')
        )
      )
      -- …o la ciudad se escribió distinto, pero es la misma provincia y el
      -- nombre es casi igual.
      OR (
        q.area_key <> ''
        AND app.fold(coalesce(v.admin_area, '')) = q.area_key
        AND (v.core_name = q.core OR extensions.similarity(v.core_name, q.core) >= 0.6)
      )
    )
  ORDER BY (v.core_name = q.core) DESC,
           extensions.similarity(v.core_name, q.core) DESC,
           (v.status = 'approved') DESC,
           v.players_count DESC
  LIMIT 5
$$;

REVOKE ALL ON FUNCTION public.similar_venues(text, text, text, text, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.similar_venues(text, text, text, text, double precision, double precision) TO authenticated;

-- ---------------------------------------------------------------------------
--  Alta. Idempotente: si el club ya está, devuelve ese.
--
--  SECURITY INVOKER: el INSERT pasa por la política de alta, así que no hay
--  forma de usar esta función para crear algo que el jugador no podría crear
--  directo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_venue(
  p_name text,
  p_country text,
  p_admin_area text,
  p_city text,
  p_address text DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL
)
RETURNS TABLE (id uuid, created boolean)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_uid uuid := auth.uid();
  v_country text := upper(btrim(coalesce(p_country, '')));
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_city text := btrim(regexp_replace(coalesce(p_city, ''), '\s+', ' ', 'g'));
  v_core text := app.venue_core_name(coalesce(p_name, ''));
  v_city_key text := app.fold(coalesce(p_city, ''));
  v_pt geography;
  v_tz text;
  v_found uuid;
  v_new uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF char_length(v_name) NOT BETWEEN 2 AND 120
     OR char_length(v_city) NOT BETWEEN 2 AND 80
     OR v_country !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'invalid_venue' USING ERRCODE = '22023';
  END IF;
  IF (p_lat IS NULL) <> (p_lng IS NULL)
     OR (p_lat IS NOT NULL AND (abs(p_lat) > 90 OR abs(p_lng) > 180)) THEN
    RAISE EXCEPTION 'invalid_location' USING ERRCODE = '22023';
  END IF;
  IF p_lat IS NOT NULL THEN
    v_pt := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  END IF;

  -- La zona horaria de un club sin ubicación exacta: la de quien lo agrega,
  -- que casi siempre juega cerca de donde vive.
  SELECT p.timezone INTO v_tz FROM public.profiles p WHERE p.id = v_uid;
  IF v_tz IS NULL THEN
    RAISE EXCEPTION 'no_profile' USING ERRCODE = '22023';
  END IF;

  -- Mismo núcleo en la misma ciudad, o a menos de 300 m: es el mismo club.
  SELECT v.id INTO v_found
  FROM public.venues v
  WHERE v.country_code = v_country
    AND v.status IN ('approved', 'pending')
    AND v.core_name = v_core
    AND (v.city_key = v_city_key
         OR (v_pt IS NOT NULL AND v.location IS NOT NULL
             AND ST_DWithin(v.location, v_pt, 300)))
  ORDER BY (v.status = 'approved') DESC, v.players_count DESC
  LIMIT 1;

  IF v_found IS NOT NULL THEN
    RETURN QUERY SELECT v_found, false;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.venues
      (name, country_code, admin_area, city, address, location, timezone,
       source, status, submitted_by)
    VALUES
      (v_name, v_country, nullif(btrim(coalesce(p_admin_area, '')), ''), v_city,
       nullif(btrim(coalesce(p_address, '')), ''), v_pt, v_tz,
       'user', 'pending', v_uid)
    RETURNING venues.id INTO v_new;
  EXCEPTION WHEN unique_violation THEN
    -- Otro jugador lo agregó en el mismo instante: se usa ese.
    SELECT v.id INTO v_found
    FROM public.venues v
    WHERE v.country_code = v_country
      AND v.city_key = v_city_key
      AND v.core_name = v_core
      AND v.source = 'user'
      AND v.status IN ('pending', 'approved')
    LIMIT 1;
    RETURN QUERY SELECT v_found, false;
    RETURN;
  END;

  RETURN QUERY SELECT v_new, true;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_venue(text, text, text, text, text, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_venue(text, text, text, text, text, double precision, double precision) TO authenticated;

-- ---------------------------------------------------------------------------
--  Ciudades conocidas de una provincia, para sugerir mientras se escribe y
--  que "Cordoba" y "Córdoba" no terminen siendo dos ciudades.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.venue_cities(p_country text, p_admin_area text DEFAULT NULL)
RETURNS TABLE (city text, venues integer)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT min(v.city), count(*)::integer
  FROM public.venues v
  WHERE v.country_code = upper(p_country)
    AND v.status IN ('approved', 'pending')
    AND v.city IS NOT NULL
    AND (p_admin_area IS NULL
         OR app.fold(coalesce(v.admin_area, '')) = app.fold(p_admin_area))
  GROUP BY v.city_key
  ORDER BY count(*) DESC, min(v.city)
  LIMIT 300
$$;

REVOKE ALL ON FUNCTION public.venue_cities(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.venue_cities(text, text) TO authenticated;
