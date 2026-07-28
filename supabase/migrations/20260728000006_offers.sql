-- ===========================================================================
--  06 · Turnos · §12.4, §12.5
--
--  Dos ejes INDEPENDIENTES, y no se colapsan nunca en un solo campo (regla 3):
--    · court_status  — ¿hay dónde jugar?   Solo lo sabe el creador.
--    · roster_status — ¿están los jugadores? Se deriva de los participantes.
-- ===========================================================================

CREATE TABLE public.match_offers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  venue_id       uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  venue_freetext text CHECK (char_length(venue_freetext) <= 120),
  court_label    text CHECK (char_length(court_label) <= 40),

  starts_at      timestamptz NOT NULL,
  duration_min   integer NOT NULL DEFAULT 90 CHECK (duration_min BETWEEN 30 AND 300),
  timezone       text NOT NULL,          -- IANA de la SEDE, no del que mira

  level_min      numeric(2,1) NOT NULL CHECK (level_min BETWEEN 1.0 AND 7.0),
  level_max      numeric(2,1) NOT NULL CHECK (level_max BETWEEN 1.0 AND 7.0),

  -- UN TURNO ES SIEMPRE 4 JUGADORES. Ni 3 ni 5: es pádel (regla 5).
  spots_open     integer NOT NULL CHECK (spots_open BETWEEN 1 AND 3),
  guests_count   integer NOT NULL DEFAULT 0 CHECK (guests_count BETWEEN 0 AND 2),

  visibility     text NOT NULL DEFAULT 'public'
                 CHECK (visibility IN ('public','followers','invite_only')),

  -- Eje 1 · LA CANCHA. 'secured' NO es "reservado por la app": es "el club ya
  -- me asignó el turno". La app nunca reserva nada (regla 2).
  court_status      text NOT NULL DEFAULT 'pending'
                    CHECK (court_status IN ('pending','secured','lost')),
  court_secured_at  timestamptz,
  court_lost_reason text CHECK (char_length(court_lost_reason) <= 200),

  -- Eje 2 · EL CUPO.
  roster_status  text NOT NULL DEFAULT 'open'
                 CHECK (roster_status IN ('open','full','cancelled','completed')),

  notes          text CHECK (char_length(notes) <= 280),

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT offers_level_band CHECK (level_max >= level_min),
  CONSTRAINT offers_always_four CHECK (1 + spots_open + guests_count = 4)
);

COMMENT ON COLUMN public.match_offers.court_status IS
  'secured = el CLUB asignó el turno. La app no reserva canchas (regla 2).';

CREATE INDEX offers_discovery_idx
  ON public.match_offers (starts_at)
  WHERE roster_status IN ('open','full');
CREATE INDEX offers_creator_idx ON public.match_offers (creator_id, starts_at DESC);
CREATE INDEX offers_level_idx
  ON public.match_offers (level_min, level_max)
  WHERE roster_status = 'open';

CREATE TRIGGER offers_touch
  BEFORE UPDATE ON public.match_offers
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- ---------------------------------------------------------------------------
--  Participantes del turno
-- ---------------------------------------------------------------------------
CREATE TABLE public.match_participants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id        uuid NOT NULL REFERENCES public.match_offers(id) ON DELETE CASCADE,
  profile_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  state           text NOT NULL DEFAULT 'requested'
                  CHECK (state IN ('requested','accepted','declined','withdrawn')),

  -- Asistencia · §12.4. `tentative` es el estado honesto que falta en casi
  -- todas estas apps: sin él la gente pone "voy" sin estar segura y el "voy"
  -- deja de significar algo.
  attendance      text NOT NULL DEFAULT 'pending'
                  CHECK (attendance IN ('pending','tentative','going','not_going')),
  attendance_at   timestamptz,
  tentative_until timestamptz,

  origin          text NOT NULL DEFAULT 'request'
                  CHECK (origin IN ('request','invitation','creator')),

  requested_at    timestamptz NOT NULL DEFAULT now(),
  decided_at      timestamptz,

  CONSTRAINT match_participants_once UNIQUE (offer_id, profile_id),
  -- Un tentativo sin fecha de vencimiento retendría un lugar para siempre.
  CONSTRAINT tentative_needs_deadline CHECK (
    attendance <> 'tentative' OR tentative_until IS NOT NULL
  )
);

CREATE INDEX match_participants_profile_idx
  ON public.match_participants (profile_id, state);
CREATE INDEX match_participants_tentative_idx
  ON public.match_participants (tentative_until)
  WHERE attendance = 'tentative';

-- ===========================================================================
--  RLS
-- ===========================================================================
ALTER TABLE public.match_offers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_offers       FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.match_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_participants FORCE  ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.match_offers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_participants TO authenticated;

CREATE OR REPLACE FUNCTION app.owns_offer(oid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.match_offers o
    WHERE o.id = oid AND o.creator_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION app.joined_offer(oid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.match_participants mp
    WHERE mp.offer_id = oid AND mp.profile_id = auth.uid()
  )
$$;

-- plpgsql y no sql: `match_invitations` se crea en la migración siguiente y
-- referencia a `match_offers`, así que la dependencia es circular. Postgres
-- valida el cuerpo de una función SQL al crearla, pero difiere el de plpgsql
-- hasta la primera ejecución — que es después de que ambas tablas existan.
CREATE OR REPLACE FUNCTION app.invited_to_offer(oid uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.match_invitations mi
    WHERE mi.offer_id = oid
      AND mi.invitee_id = auth.uid()
      AND mi.state = 'sent'
  );
END;
$$;

-- La visibilidad del turno. El invitado ve el turno al que lo invitaron
-- aunque sea `invite_only` — si no, no podría decidir.
CREATE POLICY offers_select ON public.match_offers
  FOR SELECT TO authenticated
  USING (
    creator_id = auth.uid()
    OR app.joined_offer(id)
    OR app.invited_to_offer(id)
    OR (
      roster_status IN ('open','full')
      AND NOT app.is_blocked_with(creator_id)
      AND (
        visibility = 'public'
        OR (visibility = 'followers' AND EXISTS (
              SELECT 1 FROM public.follows f
              WHERE f.follower_id = auth.uid() AND f.followee_id = creator_id))
      )
    )
  );

CREATE POLICY offers_insert ON public.match_offers
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    -- Un turno nace sin cancha confirmada y con el cupo abierto. No se puede
    -- crear ya "asegurado" saltándose el paso explícito del §12.7.
    AND court_status = 'pending'
    AND roster_status = 'open'
    AND starts_at > now()
  );

CREATE POLICY offers_update ON public.match_offers
  FOR UPDATE TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- ---------------------------------------------------------------------------
--  Participantes: los ve el creador y los demás participantes.
-- ---------------------------------------------------------------------------
CREATE POLICY match_participants_select ON public.match_participants
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR app.owns_offer(offer_id)
    OR app.joined_offer(offer_id)
  );

-- Uno se anota a sí mismo, y solo si su nivel EFECTIVO cae en la banda.
-- La regla se aplica acá, en la base — no ocultando el botón en la UI (§12.5).
-- Excepción: quien fue invitado directamente saltea la banda (§12.6).
CREATE POLICY match_participants_insert ON public.match_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND state = 'requested'
    AND (
      app.invited_to_offer(offer_id)
      OR EXISTS (
        SELECT 1
        FROM public.match_offers o
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE o.id = offer_id
          AND o.roster_status = 'open'
          AND o.starts_at > now()
          AND p.effective_level BETWEEN o.level_min AND o.level_max
      )
    )
  );

-- El creador acepta o rechaza solicitudes.
CREATE POLICY match_participants_update_owner ON public.match_participants
  FOR UPDATE TO authenticated
  USING (app.owns_offer(offer_id))
  WITH CHECK (app.owns_offer(offer_id));

-- El jugador maneja su propia asistencia y puede bajarse.
CREATE POLICY match_participants_update_self ON public.match_participants
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY match_participants_delete ON public.match_participants
  FOR DELETE TO authenticated
  USING (profile_id = auth.uid() OR app.owns_offer(offer_id));
