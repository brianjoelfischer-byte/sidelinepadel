-- ===========================================================================
--  02 · Perfiles, bloqueos y seguimiento
-- ===========================================================================

CREATE TABLE public.profiles (
  id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name       text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 40),
  slug               text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  avatar_path        text,                      -- ruta en Storage, nunca una URL
  country_code       char(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  locale             text NOT NULL DEFAULT 'es',
  timezone           text NOT NULL,             -- IANA

  -- Niveles · §12.1. Tres valores distintos, los tres públicos.
  declared_level     numeric(2,1) NOT NULL
                     CHECK (declared_level BETWEEN 1.0 AND 7.0),
  perceived_level    numeric(2,1)
                     CHECK (perceived_level BETWEEN 1.0 AND 7.0),
  effective_level    numeric(2,1) NOT NULL
                     CHECK (effective_level BETWEEN 1.0 AND 7.0),
  rater_count        integer NOT NULL DEFAULT 0 CHECK (rater_count >= 0),
  level_locked_until timestamptz,
  level_updated_at   timestamptz NOT NULL DEFAULT now(),

  preferred_side     text CHECK (preferred_side IN ('drive','reves','indistinto')),
  preferred_hand     text CHECK (preferred_hand IN ('left','right')),
  racket             text CHECK (char_length(racket) <= 80),

  -- Verificación de edad · §02. Nunca se expone: la API devuelve como mucho
  -- un booleano derivado.
  birth_date         date NOT NULL CHECK (birth_date > '1900-01-01'),

  is_public          boolean NOT NULL DEFAULT true,
  role               text NOT NULL DEFAULT 'player'
                     CHECK (role IN ('player','moderator','admin')),

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);

COMMENT ON COLUMN public.profiles.declared_level IS
  'Lo que el jugador dice que es. El sistema NUNCA lo reescribe (regla 11).';
COMMENT ON COLUMN public.profiles.effective_level IS
  'Mezcla ponderada de declarado y percibido. Es el valor que usa el matchmaking.';
COMMENT ON COLUMN public.profiles.birth_date IS
  'Solo para verificar los 16 años. No se expone por la API (§8.5).';

CREATE INDEX profiles_public_idx ON public.profiles (is_public)
  WHERE deleted_at IS NULL;
CREATE INDEX profiles_level_idx ON public.profiles (effective_level)
  WHERE deleted_at IS NULL AND is_public;
CREATE INDEX profiles_country_idx ON public.profiles (country_code)
  WHERE deleted_at IS NULL;

CREATE TRIGGER profiles_touch
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- ---------------------------------------------------------------------------
--  Historial de nivel · público en el perfil, para que bajarse deje rastro.
-- ---------------------------------------------------------------------------
CREATE TABLE public.level_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  field       text NOT NULL CHECK (field IN ('declared','effective')),
  from_value  numeric(2,1),
  to_value    numeric(2,1) NOT NULL,
  reason      text CHECK (char_length(reason) <= 120),
  changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX level_history_profile_idx
  ON public.level_history (profile_id, changed_at DESC);

-- ---------------------------------------------------------------------------
--  Bloqueos
-- ---------------------------------------------------------------------------
CREATE TABLE public.blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX blocks_blocked_idx ON public.blocks (blocked_id);

-- ---------------------------------------------------------------------------
--  Seguimiento — interés unilateral, sin aprobación (modelo Twitter).
--  NO es "amistad": la conexión real se deriva de haber jugado (§12.6).
-- ---------------------------------------------------------------------------
CREATE TABLE public.follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE INDEX follows_followee_idx ON public.follows (followee_id);

-- ===========================================================================
--  Helpers de autorización que dependen de estas tablas
-- ===========================================================================

-- Rol del usuario en curso.
--
-- SECURITY DEFINER a propósito: las políticas de `profiles` necesitan leer
-- `profiles.role`, y una consulta común dentro de una política sobre la misma
-- tabla provoca recursión infinita. Con DEFINER la lectura no vuelve a pasar
-- por RLS y el ciclo se corta.
--
-- El search_path va fijo: sin eso, un search_path manipulado podría hacer que
-- la función resuelva `profiles` a una tabla del atacante.
CREATE OR REPLACE FUNCTION app.current_role_name()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION app.is_moderator()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(app.current_role_name() IN ('moderator', 'admin'), false)
$$;

CREATE OR REPLACE FUNCTION app.is_admin()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(app.current_role_name() = 'admin', false)
$$;

-- Bloqueo simétrico: si cualquiera de los dos bloqueó al otro, no se ven.
CREATE OR REPLACE FUNCTION app.is_blocked_with(other uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = other)
       OR (blocker_id = other AND blocked_id = auth.uid())
  )
$$;

-- ===========================================================================
--  RLS
-- ===========================================================================
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles      FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.level_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.level_history FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.blocks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks        FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.follows       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows       FORCE  ROW LEVEL SECURITY;

GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.level_history TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;

-- Un perfil se lee si es propio, o si es público y no hay bloqueo de por medio.
-- Los perfiles borrados no se leen nunca.
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (
    deleted_at IS NULL
    AND (
      id = auth.uid()
      OR (is_public AND NOT app.is_blocked_with(id))
    )
  );

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    -- Nadie se crea moderador ni admin a sí mismo.
    AND role = 'player'
  );

-- Solo el dueño edita, y el rol no se puede tocar por esta vía.
-- `app.current_role_name()` es SECURITY DEFINER, así que lee el valor real
-- de la fila aunque RLS esté activo — no se lo puede engañar con el payload.
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (
    id = auth.uid()
    AND role = app.current_role_name()
  );

-- El historial es público, pero solo el del perfil que se puede ver.
CREATE POLICY level_history_select ON public.level_history
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id)
  );

-- Los bloqueos solo los ve quien los puso. Que alguien sepa que lo bloquearon
-- es justo lo que hay que evitar.
CREATE POLICY blocks_select ON public.blocks
  FOR SELECT TO authenticated
  USING (blocker_id = auth.uid());

CREATE POLICY blocks_insert ON public.blocks
  FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid());

CREATE POLICY blocks_delete ON public.blocks
  FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

-- A quién sigo es público; a quién sigue otro, también.
CREATE POLICY follows_select ON public.follows
  FOR SELECT TO authenticated
  USING (
    follower_id = auth.uid()
    OR followee_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p
               WHERE p.id = followee_id AND p.is_public)
  );

CREATE POLICY follows_insert ON public.follows
  FOR INSERT TO authenticated
  WITH CHECK (
    follower_id = auth.uid()
    AND NOT app.is_blocked_with(followee_id)
  );

CREATE POLICY follows_delete ON public.follows
  FOR DELETE TO authenticated
  USING (follower_id = auth.uid());
