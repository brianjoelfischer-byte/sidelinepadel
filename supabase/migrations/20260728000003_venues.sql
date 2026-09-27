-- ===========================================================================
--  03 · Sedes · §13
-- ===========================================================================

CREATE TABLE public.venues (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  country_code  char(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  admin_area    text,
  city          text,
  address       text,
  location      geography(Point, 4326) NOT NULL,
  timezone      text NOT NULL,        -- IANA, resuelta del punto, no del usuario
  courts_count  integer CHECK (courts_count BETWEEN 1 AND 100),
  surface_notes text CHECK (char_length(surface_notes) <= 280),

  source        text NOT NULL CHECK (source IN ('osm','user','import')),
  osm_type      text CHECK (osm_type IN ('node','way','relation')),
  osm_id        bigint,

  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected','duplicate')),
  submitted_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- Deduplicación al re-sincronizar desde Overpass.
  CONSTRAINT venues_osm_unique UNIQUE (osm_type, osm_id),
  -- Si viene de OSM, tiene que traer su identificador.
  CONSTRAINT venues_osm_complete CHECK (
    source <> 'osm' OR (osm_type IS NOT NULL AND osm_id IS NOT NULL)
  )
);

COMMENT ON TABLE public.venues IS
  'Datos base de OpenStreetMap bajo ODbL: la atribución es obligatoria (regla 21).';

CREATE INDEX venues_location_idx ON public.venues USING GIST (location);
CREATE INDEX venues_country_idx  ON public.venues (country_code, status);
CREATE INDEX venues_pending_idx  ON public.venues (created_at)
  WHERE status = 'pending';

CREATE TRIGGER venues_touch
  BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- ---------------------------------------------------------------------------
--  Búsqueda por cercanía. SECURITY INVOKER: respeta RLS del que llama.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.venues_nearby(
  lat double precision,
  lng double precision,
  radius_m integer DEFAULT 25000,
  max_results integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  name text,
  city text,
  country_code char(2),
  courts_count integer,
  distance_m double precision
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT v.id, v.name, v.city, v.country_code, v.courts_count,
         ST_Distance(v.location, ST_MakePoint(lng, lat)::geography) AS distance_m
  FROM public.venues v
  WHERE v.status = 'approved'
    AND ST_DWithin(v.location, ST_MakePoint(lng, lat)::geography,
                   least(greatest(radius_m, 100), 200000))
  ORDER BY v.location <-> ST_MakePoint(lng, lat)::geography
  LIMIT least(greatest(max_results, 1), 200)
$$;

-- ===========================================================================
--  RLS
-- ===========================================================================
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues FORCE  ROW LEVEL SECURITY;

GRANT SELECT ON public.venues TO anon, authenticated;
GRANT INSERT ON public.venues TO authenticated;
GRANT UPDATE ON public.venues TO authenticated;   -- acotado por la política
GRANT EXECUTE ON FUNCTION public.venues_nearby TO anon, authenticated;

-- Las aprobadas las ve cualquiera; las propuestas, quien las propuso y los
-- moderadores.
CREATE POLICY venues_select ON public.venues
  FOR SELECT TO anon, authenticated
  USING (
    status = 'approved'
    OR submitted_by = auth.uid()
    OR app.is_moderator()
  );

-- Un usuario propone; entra siempre como 'pending' y como 'user'.
-- No puede autoaprobarse ni hacerse pasar por origen OSM.
CREATE POLICY venues_insert ON public.venues
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND status = 'pending'
    AND source = 'user'
    AND approved_by IS NULL
  );

-- Solo moderadores editan sedes. Un usuario no corrige la suya después de
-- enviarla: la borra y la vuelve a proponer, o pide moderación.
CREATE POLICY venues_update ON public.venues
  FOR UPDATE TO authenticated
  USING (app.is_moderator())
  WITH CHECK (app.is_moderator());
