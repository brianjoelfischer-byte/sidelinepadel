-- ===========================================================================
--  09 · Límite de desvío en las valoraciones de nivel
-- ===========================================================================
--
--  Una valoración no puede alejarse más de 2.5 puntos del nivel efectivo que
--  la persona tiene HOY.
--
--  Por qué hace falta, además de los frenos que ya existían: la media
--  recortada del §12.2 descarta el 10 % de los extremos, pero recién con 10
--  votantes o más. Con pocos votantes, un amigo poniendo 1.0 de chiste a
--  alguien de 4.0 sí movía el número. Este límite corta esa broma en la
--  puerta de entrada, no después de promediar.
--
--  Es una ventana MÓVIL, no un techo: a medida que el efectivo se corrige, la
--  ventana se corre con él. Así una categoría mal declarada igual converge —
--  lento, que es justo lo que pide la regla 14 — pero nadie la puede hundir de
--  un golpe.
-- ===========================================================================

ALTER TABLE public.level_ratings
  ADD COLUMN IF NOT EXISTS subject_level_at_rating numeric(2,1);

COMMENT ON COLUMN public.level_ratings.subject_level_at_rating IS
  'Nivel efectivo del valorado en el momento del voto. Se guarda para poder '
  'auditar después si una valoración era razonable en su contexto.';

-- Desvío máximo permitido respecto del nivel efectivo actual.
CREATE OR REPLACE FUNCTION app.max_rating_deviation()
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 2.5::numeric $$;

/**
 * Valida el rango y deja registrado el nivel de referencia.
 *
 * Va en un trigger y no en un CHECK porque un CHECK no puede consultar otra
 * tabla, y el límite depende del nivel que tiene el valorado en ese momento.
 */
CREATE OR REPLACE FUNCTION app.enforce_rating_bounds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  subject_level numeric;
  max_dev       numeric := app.max_rating_deviation();
BEGIN
  SELECT effective_level INTO subject_level
  FROM public.profiles
  WHERE id = NEW.subject_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no existe el perfil valorado';
  END IF;

  IF abs(NEW.value - subject_level) > max_dev THEN
    RAISE EXCEPTION
      'valoracion fuera de rango: % esta a mas de % puntos del nivel actual (%)',
      NEW.value, max_dev, subject_level
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.subject_level_at_rating := subject_level;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS level_ratings_bounds ON public.level_ratings;
CREATE TRIGGER level_ratings_bounds
  BEFORE INSERT OR UPDATE OF value ON public.level_ratings
  FOR EACH ROW EXECUTE FUNCTION app.enforce_rating_bounds();

-- ---------------------------------------------------------------------------
--  Rango permitido, para que la interfaz muestre el mismo límite que aplica
--  la base. Duplicar el número en el cliente sería garantizar que en algún
--  momento difieran.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rating_bounds_for(subject uuid)
RETURNS TABLE (min_value numeric, max_value numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    greatest(1.0, p.effective_level - app.max_rating_deviation()),
    least(7.0, p.effective_level + app.max_rating_deviation())
  FROM public.profiles p
  WHERE p.id = subject
$$;

GRANT EXECUTE ON FUNCTION public.rating_bounds_for TO authenticated;
