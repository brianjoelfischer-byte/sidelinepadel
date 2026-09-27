-- ===========================================================================
--  04 · Sesiones registradas y sus participantes · §05
-- ===========================================================================

CREATE TABLE public.sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (kind IN ('match','training','quick_match')),
  played_on      date NOT NULL CHECK (played_on >= '2000-01-01'),

  venue_id       uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  venue_freetext text CHECK (char_length(venue_freetext) <= 120),

  result         text CHECK (result IN ('win','loss','draw')),
  sets           jsonb,
  side_played    text CHECK (side_played IN ('drive','reves')),
  self_rating    integer CHECK (self_rating BETWEEN 1 AND 10),

  -- Promedio de lo que el dueño asignó a los rivales. Calculado, no ingresado.
  opponents_avg_level numeric(2,1)
                 CHECK (opponents_avg_level BETWEEN 1.0 AND 7.0),

  notes          text CHECK (char_length(notes) <= 160),

  -- Origen: si vino de un torneo, apunta al partido (§17.4). La FK se agrega
  -- en la migración de torneos para no crear una dependencia circular.
  tournament_match_id uuid,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  -- Un entrenamiento no tiene resultado; un partido sí.
  CONSTRAINT sessions_result_matches_kind CHECK (
    (kind = 'training' AND result IS NULL) OR
    (kind <> 'training' AND result IS NOT NULL)
  )
);

CREATE INDEX sessions_owner_idx ON public.sessions (owner_id, played_on DESC);
CREATE INDEX sessions_venue_idx ON public.sessions (venue_id)
  WHERE venue_id IS NOT NULL;

CREATE TRIGGER sessions_touch
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- ---------------------------------------------------------------------------
--  Participantes
--
--  Un partido lo registra UNA persona y menciona a otras. Por eso existe
--  `confirmed_at`: lo que A escribe sobre B no cuenta en las estadísticas de B
--  hasta que B lo confirme (§05). Sin eso, cualquiera podría inflar o ensuciar
--  el historial ajeno.
-- ---------------------------------------------------------------------------
CREATE TABLE public.session_participants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,

  profile_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_name      text CHECK (char_length(guest_name) BETWEEN 1 AND 60),

  team            text NOT NULL CHECK (team IN ('mine','opponent')),
  perceived_level numeric(2,1) CHECK (perceived_level BETWEEN 1.0 AND 7.0),

  confirmed_at    timestamptz,
  rejected_at     timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),

  -- O es un usuario registrado, o es un invitado suelto. Nunca los dos.
  CONSTRAINT participant_identity CHECK (
    num_nonnulls(profile_id, guest_name) = 1
  ),
  -- No se puede confirmar y rechazar a la vez.
  CONSTRAINT participant_decision CHECK (
    num_nonnulls(confirmed_at, rejected_at) <= 1
  ),
  -- Un usuario aparece una sola vez por sesión.
  CONSTRAINT participant_unique UNIQUE (session_id, profile_id)
);

CREATE INDEX session_participants_profile_idx
  ON public.session_participants (profile_id, confirmed_at)
  WHERE profile_id IS NOT NULL;
CREATE INDEX session_participants_pending_idx
  ON public.session_participants (profile_id)
  WHERE profile_id IS NOT NULL
    AND confirmed_at IS NULL
    AND rejected_at IS NULL;

-- ===========================================================================
--  RLS
-- ===========================================================================
ALTER TABLE public.sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions             FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants FORCE  ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_participants TO authenticated;

-- ---------------------------------------------------------------------------
--  Helper: ¿puedo ver esta sesión?
--
--  SECURITY DEFINER para cortar la recursión entre `sessions` y
--  `session_participants`: cada política necesita consultar la otra tabla, y
--  sin DEFINER se llaman en círculo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.can_see_session(sid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions s WHERE s.id = sid AND s.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = sid
      AND sp.profile_id = auth.uid()
      AND sp.confirmed_at IS NOT NULL
  )
$$;

-- Ve la sesión el dueño, y quien fue etiquetado Y confirmó.
-- Quien todavía no confirmó ve la invitación por `session_participants`,
-- no la sesión completa.
CREATE POLICY sessions_select ON public.sessions
  FOR SELECT TO authenticated
  USING (app.can_see_session(id));

CREATE POLICY sessions_insert ON public.sessions
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY sessions_update ON public.sessions
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY sessions_delete ON public.sessions
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
--  Participantes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.owns_session(sid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions s WHERE s.id = sid AND s.owner_id = auth.uid()
  )
$$;

-- Lo ve el dueño de la sesión, y el propio etiquetado (aunque no haya
-- confirmado: necesita ver que lo etiquetaron para poder decidir).
CREATE POLICY session_participants_select ON public.session_participants
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR app.owns_session(session_id));

CREATE POLICY session_participants_insert ON public.session_participants
  FOR INSERT TO authenticated
  WITH CHECK (app.owns_session(session_id));

-- Dos caminos distintos y deliberadamente separados:
--   · el dueño edita los datos del partido (equipo, nivel percibido)
--   · el etiquetado solo decide si acepta o rechaza
-- El WITH CHECK impide que el etiquetado se cambie de equipo o se reasigne.
CREATE POLICY session_participants_update_owner ON public.session_participants
  FOR UPDATE TO authenticated
  USING (app.owns_session(session_id))
  WITH CHECK (app.owns_session(session_id));

CREATE POLICY session_participants_update_self ON public.session_participants
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY session_participants_delete ON public.session_participants
  FOR DELETE TO authenticated
  USING (app.owns_session(session_id));
