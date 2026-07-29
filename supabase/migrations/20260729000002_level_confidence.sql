-- ===========================================================================
--  10 · Confianza del nivel · adaptado de los sistemas de rango competitivos
-- ===========================================================================
--
--  QUÉ PROBLEMA RESUELVE
--
--  El freno anterior era fijo: 0,5 puntos cada 30 días para todo el mundo. Eso
--  trata igual dos casos opuestos:
--
--    · Alguien recién llegado que declaró 3.0 y en realidad es 5.0. Con el
--      freno fijo tarda CUATRO MESES en llegar a su nivel real. Mientras
--      tanto juega partidos desparejos y arruina turnos ajenos.
--    · Alguien con 40 partidos y 25 votantes, cuyo nivel ya se conoce bien.
--      A ese sí conviene moverlo despacio.
--
--  CÓMO LO RESUELVEN LOS JUEGOS
--
--  Glicko-2 (Rocket League) le agrega a cada jugador una "desviación de
--  rating" (RD): cuánta INCERTIDUMBRE hay sobre su número. Con RD alta el
--  rating se mueve mucho; con RD baja, poco. Y algo más fino: un rival con RD
--  alta aporta menos información, así que su resultado pesa menos.
--
--  Valorant hace lo mismo con otro vocabulario: las cuentas nuevas tienen
--  "MMR de alta incertidumbre" y por eso llegan a su nivel real en 20-30
--  partidas en vez de cientos.
--
--  Y todos usan reinicio SUAVE, nunca duro: la incertidumbre sube con la
--  inactividad, pero lo aprendido no se tira.
--
--  QUÉ TOMAMOS
--
--  Una `level_confidence` de 0 a 1 que reemplaza el freno fijo por uno
--  adaptativo. Sin ELO ni resultados automáticos: el insumo sigue siendo la
--  valoración humana del §12.2. Lo que cambia es la VELOCIDAD a la que el
--  nivel efectivo puede moverse.
-- ===========================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS level_confidence numeric(3,2) NOT NULL DEFAULT 0
    CHECK (level_confidence BETWEEN 0 AND 1);

COMMENT ON COLUMN public.profiles.level_confidence IS
  'Cuánto sabemos del nivel de esta persona: 0 = nada, 1 = mucho. '
  'Crece con votantes distintos y decae con la inactividad.';

-- ---------------------------------------------------------------------------
--  Cálculo de la confianza
--
--    votantes:    n / (n + 8)   — nunca llega a 1, siempre queda margen a
--                                 seguir aprendiendo, como la RD de Glicko
--    frescura:    0.5 ^ (días desde el último partido / 240)
--
--  El producto castiga los dos casos malos: pocos votantes, o muchos pero
--  viejos. Alguien que jugó 50 partidos y paró hace dos años vuelve a ser
--  incierto — que es la verdad, porque el nivel cambia cuando dejás de jugar.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.compute_level_confidence(subject uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH raters AS (
    SELECT count(DISTINCT lr.rater_id)::numeric AS n
    FROM public.level_ratings lr
    WHERE lr.subject_id = subject
      AND app.rater_is_eligible(lr.rater_id)
  ),
  last_played AS (
    SELECT max(s.played_on) AS played_on
    FROM public.session_participants sp
    JOIN public.sessions s ON s.id = sp.session_id
    WHERE sp.profile_id = subject AND sp.confirmed_at IS NOT NULL
  )
  SELECT round(
    (SELECT n / (n + 8) FROM raters)
    * coalesce(
        (SELECT power(0.5, (current_date - played_on)::numeric / 240)
         FROM last_played WHERE played_on IS NOT NULL),
        0
      ),
    2
  )
$$;

-- ---------------------------------------------------------------------------
--  Freno adaptativo
--
--    confianza 0.00  →  1.5 puntos / 30 días   (calibración: converge rápido)
--    confianza 0.50  →  0.9
--    confianza 1.00  →  0.3                    (establecido: protegido)
--
--  Es el mismo principio que "las cuentas nuevas se mueven mucho": cuanto
--  menos sabemos, más rápido corregimos; cuanto más sabemos, más caro es
--  moverlo — y por lo tanto más difícil de manipular.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.max_step_for_confidence(confidence numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT round(1.5 - 1.2 * greatest(0, least(1, coalesce(confidence, 0))), 2)
$$;

-- ---------------------------------------------------------------------------
--  Mezcla con freno adaptativo. Reemplaza la versión de paso fijo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.blend_effective_level(
  declared     numeric,
  perceived    numeric,
  raters       integer,
  current_eff  numeric,
  last_change  timestamptz,
  confidence   numeric DEFAULT 0
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  w        numeric;
  target   numeric;
  budget   numeric;
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

  -- Presupuesto de movimiento.
  --
  -- En Glicko el ajuste depende de la INCERTIDUMBRE, no del reloj. Acá igual:
  -- siempre hay al menos un paso completo disponible, y el tiempo solo lo
  -- agranda. Atarlo únicamente al tiempo transcurrido tenía un agujero: un
  -- jugador recién creado tiene `elapsed` ≈ 0, así que se movía 0,1 puntos
  -- —el piso— por bien declarada que estuviera la corrección.
  --
  -- Esto no permite deriva acumulada: cada recálculo se acerca al objetivo y
  -- se detiene ahí, nunca lo pasa. El paso limita la VELOCIDAD de llegada, no
  -- el destino, y el destino ya está acotado por la mezcla (que conserva peso
  -- del declarado) y por la ventana de ±2,5 de cada voto.
  elapsed := extract(epoch FROM now() - last_change) / (30 * 86400);
  budget  := app.max_step_for_confidence(confidence) * greatest(1, elapsed);

  IF abs(target - current_eff) <= budget THEN
    RETURN target;
  END IF;

  RETURN round(current_eff + sign(target - current_eff) * budget, 1);
END;
$$;

-- ---------------------------------------------------------------------------
--  Peso del votante según SU propia confianza
--
--  De Glicko: un rival cuya fuerza real no se conoce aporta poca información.
--  Acá igual — la opinión de alguien cuyo propio nivel es incierto pesa menos,
--  pero nunca cero (piso 0.4): jugó el partido y vio algo.
--
--  Efecto lateral valioso: una red de cuentas nuevas coordinadas tiene
--  confianza baja entre todas, así que su peso combinado es chico sin que
--  haga falta detectarlas como fraude.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.rater_weight(rater uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT greatest(0.4, coalesce(p.level_confidence, 0))
  FROM public.profiles p
  WHERE p.id = rater
$$;

-- ---------------------------------------------------------------------------
--  Percibido, ahora ponderando por la confianza de cada votante.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.compute_perceived_level(subject uuid)
RETURNS TABLE (perceived numeric, raters integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH voices AS (
    -- Una voz por votante, con decaimiento por antigüedad del voto.
    SELECT
      lr.rater_id,
      sum(lr.value * power(0.5, extract(epoch FROM now() - lr.created_at)
                                 / (180 * 86400)))
        / nullif(sum(power(0.5, extract(epoch FROM now() - lr.created_at)
                                 / (180 * 86400))), 0) AS voice,
      max(power(0.5, extract(epoch FROM now() - lr.created_at)
                     / (180 * 86400))) * app.rater_weight(lr.rater_id) AS weight
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
    SELECT voice, weight FROM ranked
    WHERE n < 10 OR (pct >= 0.10 AND pct <= 0.90)
  )
  SELECT
    round(sum(voice * weight) / nullif(sum(weight), 0), 1)::numeric,
    (SELECT count(*)::integer FROM voices)
  FROM trimmed
$$;

-- ---------------------------------------------------------------------------
--  Recalculo completo, ahora incluyendo la confianza.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.refresh_level(subject uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  calc       record;
  prof       record;
  confidence numeric;
  new_eff    numeric;
BEGIN
  SELECT * INTO prof FROM public.profiles WHERE id = subject;
  IF NOT FOUND THEN RETURN; END IF;

  confidence := app.compute_level_confidence(subject);
  SELECT * INTO calc FROM app.compute_perceived_level(subject);

  new_eff := app.blend_effective_level(
    prof.declared_level, calc.perceived, coalesce(calc.raters, 0),
    prof.effective_level, prof.level_updated_at, confidence
  );

  IF new_eff IS DISTINCT FROM prof.effective_level THEN
    INSERT INTO public.level_history (profile_id, field, from_value, to_value, reason)
    VALUES (subject, 'effective', prof.effective_level, new_eff, 'recalculo');
  END IF;

  UPDATE public.profiles
  SET perceived_level  = calc.perceived,
      rater_count      = coalesce(calc.raters, 0),
      level_confidence = coalesce(confidence, 0),
      effective_level  = new_eff,
      level_updated_at = CASE
        WHEN new_eff IS DISTINCT FROM prof.effective_level THEN now()
        ELSE prof.level_updated_at
      END
  WHERE id = subject;
END;
$$;
