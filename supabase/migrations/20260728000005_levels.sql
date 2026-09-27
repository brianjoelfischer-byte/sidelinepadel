-- ===========================================================================
--  05 · Valoraciones de nivel y conexiones derivadas · §12.2, §12.6
-- ===========================================================================

CREATE TABLE public.level_ratings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  rater_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  value      numeric(2,1) NOT NULL CHECK (value BETWEEN 1.0 AND 7.0),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT level_ratings_not_self CHECK (rater_id <> subject_id),
  -- Un voto por partido y por par (§12.3, regla 2).
  CONSTRAINT level_ratings_once UNIQUE (session_id, rater_id, subject_id)
);

CREATE INDEX level_ratings_subject_idx
  ON public.level_ratings (subject_id, created_at DESC);
CREATE INDEX level_ratings_rater_idx
  ON public.level_ratings (rater_id);

-- ---------------------------------------------------------------------------
--  Elegibilidad del votante · §12.3, regla 3
--  Una cuenta con menos de 3 sesiones confirmadas no mueve el nivel de nadie.
--  El voto igual se guarda y entra retroactivamente al llegar al mínimo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.rater_is_eligible(rater uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(*) >= 3
  FROM public.session_participants sp
  WHERE sp.profile_id = rater AND sp.confirmed_at IS NOT NULL
$$;

-- ---------------------------------------------------------------------------
--  Cálculo del nivel percibido · §12.2
--
--  Cuatro pasos, en este orden:
--    1. Una voz por votante — el promedio de sus valoraciones. Que alguien
--       te haya valorado 10 veces no le da 10 votos.
--    2. Decaimiento 0.5 ^ (días / 180): lo viejo pesa menos, porque la gente
--       mejora y el nivel tiene que poder seguirla.
--    3. Media recortada al 10 % con 10+ votantes: neutraliza tanto al amigo
--       que infla como al rival dolido.
--    4. Solo cuentan los votantes elegibles.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.compute_perceived_level(subject uuid)
RETURNS TABLE (perceived numeric, raters integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH voices AS (
    -- Paso 1 y 2: una voz por votante, con peso por antigüedad.
    SELECT
      lr.rater_id,
      sum(lr.value * power(0.5, extract(epoch FROM now() - lr.created_at)
                                 / (180 * 86400)))
        / nullif(sum(power(0.5, extract(epoch FROM now() - lr.created_at)
                                 / (180 * 86400))), 0) AS voice,
      max(power(0.5, extract(epoch FROM now() - lr.created_at)
                     / (180 * 86400)))                 AS weight
    FROM public.level_ratings lr
    WHERE lr.subject_id = subject
      AND app.rater_is_eligible(lr.rater_id)
    GROUP BY lr.rater_id
  ),
  ranked AS (
    SELECT voice, weight,
           percent_rank() OVER (ORDER BY voice) AS pct,
           count(*)       OVER ()               AS n
    FROM voices
  ),
  trimmed AS (
    -- Paso 3: recorte solo si hay muestra suficiente para que tenga sentido.
    SELECT voice, weight FROM ranked
    WHERE n < 10 OR (pct >= 0.10 AND pct <= 0.90)
  )
  SELECT
    round(sum(voice * weight) / nullif(sum(weight), 0), 1)::numeric,
    (SELECT count(*)::integer FROM voices)
  FROM trimmed
$$;

-- ---------------------------------------------------------------------------
--  Nivel efectivo · §12.2, pasos 4 y 5
--
--    w = n / (n + 5)                          (credibilidad por nº de votantes)
--    efectivo = (1 - w)·declarado + w·percibido
--
--  Y el freno: no más de 0,5 puntos cada 30 días (regla 14). Es lo que impide
--  que un grupo coordinado hunda a alguien en una semana.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.blend_effective_level(
  declared     numeric,
  perceived    numeric,
  raters       integer,
  current_eff  numeric,
  last_change  timestamptz
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  w        numeric;
  target   numeric;
  max_step numeric;
  elapsed  numeric;
BEGIN
  IF perceived IS NULL OR raters = 0 THEN
    RETURN declared;
  END IF;

  w      := raters::numeric / (raters + 5);
  target := round((1 - w) * declared + w * perceived, 1);

  IF current_eff IS NULL OR last_change IS NULL THEN
    RETURN target;
  END IF;

  -- Presupuesto de movimiento acumulado desde el último cambio.
  elapsed  := extract(epoch FROM now() - last_change) / (30 * 86400);
  max_step := greatest(0.1, round(0.5 * elapsed, 1));

  IF abs(target - current_eff) <= max_step THEN
    RETURN target;
  END IF;

  RETURN round(
    current_eff + sign(target - current_eff) * max_step,
    1
  );
END;
$$;

-- ---------------------------------------------------------------------------
--  Recalcular y persistir. La llama el servidor tras cada valoración nueva y
--  un job nocturno (el decaimiento corre solo con el tiempo).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.refresh_level(subject uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  calc     record;
  prof     record;
  new_eff  numeric;
BEGIN
  SELECT * INTO prof FROM public.profiles WHERE id = subject;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO calc FROM app.compute_perceived_level(subject);

  new_eff := app.blend_effective_level(
    prof.declared_level, calc.perceived, coalesce(calc.raters, 0),
    prof.effective_level, prof.level_updated_at
  );

  IF new_eff IS DISTINCT FROM prof.effective_level THEN
    INSERT INTO public.level_history (profile_id, field, from_value, to_value, reason)
    VALUES (subject, 'effective', prof.effective_level, new_eff, 'recalculo');
  END IF;

  UPDATE public.profiles
  SET perceived_level  = calc.perceived,
      rater_count      = coalesce(calc.raters, 0),
      effective_level  = new_eff,
      level_updated_at = CASE
        WHEN new_eff IS DISTINCT FROM prof.effective_level THEN now()
        ELSE level_updated_at
      END
  WHERE id = subject;
END;
$$;

-- ---------------------------------------------------------------------------
--  Conexiones · §12.6
--
--  No hay solicitud de amistad: haber jugado juntos ES la conexión. Por eso
--  es una vista derivada de hechos y no una tabla con estado propio — no hay
--  nada que aceptar, ni una cola de pendientes, ni algo que se desincronice.
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW public.played_with AS
SELECT
  a.profile_id                       AS profile_id,
  b.profile_id                       AS other_id,
  count(*)::integer                  AS times_played,
  max(s.played_on)                   AS last_played_on,
  min(s.played_on)                   AS first_played_on
FROM public.session_participants a
JOIN public.session_participants b
  ON b.session_id = a.session_id
 AND b.profile_id IS DISTINCT FROM a.profile_id
JOIN public.sessions s ON s.id = a.session_id
WHERE a.profile_id IS NOT NULL
  AND b.profile_id IS NOT NULL
  AND a.confirmed_at IS NOT NULL
  AND b.confirmed_at IS NOT NULL
GROUP BY a.profile_id, b.profile_id;

-- UNIQUE es requisito para poder refrescar CONCURRENTLY.
CREATE UNIQUE INDEX played_with_pk_idx
  ON public.played_with (profile_id, other_id);
CREATE INDEX played_with_frequency_idx
  ON public.played_with (profile_id, times_played DESC, last_played_on DESC);

-- ===========================================================================
--  RLS
-- ===========================================================================
ALTER TABLE public.level_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.level_ratings FORCE  ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.level_ratings TO authenticated;

-- El valor individual de cada voto es PRIVADO: solo lo ve quien lo emitió.
-- Se publica el agregado (`profiles.perceived_level`), nunca quién puso qué.
-- Si esto se rompe aparecen las represalias y la gente vota político (regla 12).
CREATE POLICY level_ratings_select ON public.level_ratings
  FOR SELECT TO authenticated
  USING (rater_id = auth.uid());

-- Solo valora quien jugó ESA sesión y la confirmó, y solo sobre alguien que
-- también estuvo en ella (§12.3, regla 1).
CREATE POLICY level_ratings_insert ON public.level_ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    rater_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.session_id = level_ratings.session_id
        AND sp.profile_id = auth.uid()
        AND sp.confirmed_at IS NOT NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.session_id = level_ratings.session_id
        AND sp.profile_id = level_ratings.subject_id
    )
  );

CREATE POLICY level_ratings_update ON public.level_ratings
  FOR UPDATE TO authenticated
  USING (rater_id = auth.uid())
  WITH CHECK (rater_id = auth.uid());

-- Las vistas materializadas no soportan RLS. Se protege quitándole el acceso
-- directo a los roles de la API: se consulta por la función de abajo, que sí
-- filtra por el usuario en curso.
REVOKE ALL ON public.played_with FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_connections(max_results integer DEFAULT 100)
RETURNS TABLE (
  other_id       uuid,
  display_name   text,
  slug           text,
  effective_level numeric,
  times_played   integer,
  last_played_on date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pw.other_id, p.display_name, p.slug, p.effective_level,
         pw.times_played, pw.last_played_on
  FROM public.played_with pw
  JOIN public.profiles p ON p.id = pw.other_id
  WHERE pw.profile_id = auth.uid()
    AND p.deleted_at IS NULL
    AND NOT app.is_blocked_with(pw.other_id)
  ORDER BY pw.times_played DESC, pw.last_played_on DESC
  LIMIT least(greatest(max_results, 1), 500)
$$;

GRANT EXECUTE ON FUNCTION public.my_connections TO authenticated;
