-- ===========================================================================
--  08 · Push, recordatorios, logros y moderación · §14, §05
-- ===========================================================================

-- ---------------------------------------------------------------------------
--  Suscripciones push. El endpoint y las claves son CREDENCIALES: quien las
--  tenga puede mandarle notificaciones a esa persona. No se exponen a nadie
--  más que a su dueño, y nunca se loguean (§8.5).
-- ---------------------------------------------------------------------------
CREATE TABLE public.push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint      text NOT NULL UNIQUE,
  p256dh        text NOT NULL,
  auth_key      text NOT NULL,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_ok_at    timestamptz,
  failure_count integer NOT NULL DEFAULT 0
);

CREATE INDEX push_subscriptions_profile_idx
  ON public.push_subscriptions (profile_id);

-- ---------------------------------------------------------------------------
--  Recordatorios · §14
--
--  Cuelgan del EJE CUPO, no del eje cancha: un turno sin cancha confirmada
--  igual manda avisos, porque la gente tiene que saber que se comprometió y
--  el creador tiene que sentir la presión de conseguirla.
-- ---------------------------------------------------------------------------
CREATE TABLE public.reminders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id   uuid NOT NULL REFERENCES public.match_offers(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  kind       text NOT NULL CHECK (kind IN (
               'confirm_request',   -- −24 h · a quien no respondió
               'court_nudge',       -- −24 h · al creador, si falta cancha
               'tentative_expiry',  -- al vencer el tentativo
               'match_reminder'     -- −30 min · a los confirmados
             )),
  channel    text NOT NULL CHECK (channel IN ('push','email')),
  fire_at    timestamptz NOT NULL,

  state      text NOT NULL DEFAULT 'pending'
             CHECK (state IN ('pending','sent','failed','cancelled')),
  attempts   integer NOT NULL DEFAULT 0,
  sent_at    timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT reminders_once UNIQUE (offer_id, profile_id, kind, channel)
);

-- El índice que usa el cron. Parcial: solo lo pendiente, que es lo único
-- que se consulta cada 5 minutos.
CREATE INDEX reminders_due_idx ON public.reminders (fire_at)
  WHERE state = 'pending';

-- ---------------------------------------------------------------------------
--  Logros
-- ---------------------------------------------------------------------------
CREATE TABLE public.achievements (
  code            text PRIMARY KEY,
  name_key        text NOT NULL,     -- clave de i18n, NO texto (regla 33)
  description_key text NOT NULL,
  icon            text NOT NULL,
  criteria        jsonb NOT NULL DEFAULT '{}',
  sort_order      integer NOT NULL DEFAULT 0
);

CREATE TABLE public.profile_achievements (
  profile_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_code   text NOT NULL REFERENCES public.achievements(code) ON DELETE CASCADE,
  unlocked_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, achievement_code)
);

-- ---------------------------------------------------------------------------
--  Auditoría · §05
--  La IP NUNCA en claro: solo su hash con pepper (§8.5).
-- ---------------------------------------------------------------------------
CREATE TABLE public.audit_log (
  id         bigserial PRIMARY KEY,
  actor_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action     text NOT NULL,
  entity     text NOT NULL,
  entity_id  uuid,
  metadata   jsonb NOT NULL DEFAULT '{}',
  ip_hash    bytea,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_actor_idx  ON public.audit_log (actor_id, created_at DESC);
CREATE INDEX audit_log_entity_idx ON public.audit_log (entity, entity_id);

CREATE TABLE public.abuse_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_type text NOT NULL CHECK (target_type IN ('profile','session','offer','venue')),
  target_id   uuid NOT NULL,
  reason      text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  state       text NOT NULL DEFAULT 'open'
              CHECK (state IN ('open','reviewing','resolved','dismissed')),
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX abuse_reports_open_idx ON public.abuse_reports (created_at)
  WHERE state IN ('open','reviewing');

-- ===========================================================================
--  RLS
-- ===========================================================================
ALTER TABLE public.push_subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions   FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.reminders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders            FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.achievements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements         FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.profile_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_achievements FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.audit_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log            FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.abuse_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abuse_reports        FORCE  ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;
GRANT SELECT ON public.reminders TO authenticated;
GRANT SELECT ON public.achievements TO anon, authenticated;
GRANT SELECT ON public.profile_achievements TO anon, authenticated;
GRANT INSERT ON public.abuse_reports TO authenticated;
GRANT SELECT ON public.abuse_reports TO authenticated;
-- `audit_log` no se expone a la API: lo escribe el servidor con service_role.
-- Sin GRANT y sin políticas, para un usuario no existe.

CREATE POLICY push_subscriptions_all ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Cada uno ve sus propios recordatorios; escribirlos es cosa del servidor.
CREATE POLICY reminders_select ON public.reminders
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- El catálogo de logros es público (son claves de i18n, no datos de nadie).
CREATE POLICY achievements_select ON public.achievements
  FOR SELECT TO anon, authenticated
  USING (true);

-- Los logros de alguien se ven si su perfil se ve.
CREATE POLICY profile_achievements_select ON public.profile_achievements
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id));

CREATE POLICY abuse_reports_insert ON public.abuse_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- Quien reporta ve su reporte; los moderadores ven la cola.
CREATE POLICY abuse_reports_select ON public.abuse_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR app.is_moderator());
