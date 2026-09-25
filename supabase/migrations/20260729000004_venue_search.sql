-- ===========================================================================
--  12 · Búsqueda de sedes · §13
-- ===========================================================================
--
-- El buscador de "Dónde jugaste": escribís parte del nombre o de la ciudad y
-- aparecen los clubes cargados desde OpenStreetMap.
--
-- Sin extensiones nuevas a propósito. `unaccent` y `pg_trgm` resolverían
-- esto con menos código, pero en Supabase se instalan en el esquema
-- `extensions` y en un Postgres local en `public`: una función que las llame
-- por nombre funciona en un lado y se rompe en el otro. Con unos miles de
-- sedes por país, recorrerlas es instantáneo; si algún día son cientos de
-- miles, ahí se suma un índice de trigramas.

-- ---------------------------------------------------------------------------
--  Plegado de texto: minúsculas, sin tildes, espacios simples.
--  "Pádel  CÓRDOBA" → "padel cordoba". IMMUTABLE para poder usarla en una
--  columna generada.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.fold(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT btrim(regexp_replace(
    lower(translate(t,
      'áàäâãåÁÀÄÂÃÅéèëêÉÈËÊíìïîÍÌÏÎóòöôõÓÒÖÔÕúùüûÚÙÜÛñÑçÇ',
      'aaaaaaaaaaaaeeeeeeeeiiiiiiiioooooooooouuuuuuuunncc')),
    '\s+', ' ', 'g'))
$$;

-- ---------------------------------------------------------------------------
--  Columnas derivadas
--
--  lat/lng: la ubicación es geography, que por la API llega como texto
--  binario. Los números sueltos son lo que hace falta para armar el enlace
--  a Google Maps sin decodificar nada en la app.
--
--  search_text: nombre, ciudad y dirección ya plegados, calculados una vez al
--  guardar y no en cada búsqueda.
-- ---------------------------------------------------------------------------
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS lat double precision
    GENERATED ALWAYS AS (ST_Y(location::geometry)) STORED,
  ADD COLUMN IF NOT EXISTS lng double precision
    GENERATED ALWAYS AS (ST_X(location::geometry)) STORED,
  ADD COLUMN IF NOT EXISTS search_text text
    GENERATED ALWAYS AS (
      app.fold(name || ' ' || coalesce(city, '') || ' ' || coalesce(address, ''))
    ) STORED;

-- ---------------------------------------------------------------------------
--  Búsqueda
--
--  · Cada palabra tiene que aparecer en nombre, ciudad o dirección: "belgrano
--    cordoba" encuentra "Club Atlético Belgrano" de Córdoba.
--  · Primero las de tu país, después las que empiezan con lo que escribiste,
--    después por nombre.
--  · %, _ y \ se escapan: si no, escribir "%" traería todas las sedes.
--  · SECURITY INVOKER: rige la RLS de quien busca. Además se filtra a
--    aprobadas y propias, para que un moderador no vea pendientes ajenas
--    mezcladas en el buscador.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_venues(
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
  lng double precision
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
         v.country_code::text, v.courts_count, v.lat, v.lng
  FROM public.venues v, words
  WHERE char_length(app.fold(coalesce(q, ''))) >= 2
    AND (v.status = 'approved' OR v.submitted_by = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM unnest(words.ws) AS w
      WHERE v.search_text NOT LIKE '%' || w || '%'
    )
  ORDER BY
    (v.country_code = upper(prefer_country)) DESC NULLS LAST,
    (app.fold(v.name) LIKE words.ws[1] || '%') DESC,
    v.name
  LIMIT least(greatest(coalesce(max_results, 8), 1), 20)
$$;

REVOKE ALL ON FUNCTION public.search_venues(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_venues(text, text, integer) TO authenticated;
