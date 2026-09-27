-- ===========================================================================
--  07 · Invitaciones y supresión de correo · §12.6
-- ===========================================================================

CREATE TABLE public.match_invitations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id      uuid NOT NULL REFERENCES public.match_offers(id) ON DELETE CASCADE,
  inviter_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Exactamente uno. El email solo para quien todavía no tiene cuenta.
  invitee_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_email citext,

  -- El token en claro vive SOLO en el correo. Acá va su SHA-256, así que un
  -- volcado de la base no sirve para aceptar invitaciones ajenas (§12.6).
  token_hash    bytea UNIQUE,

  state         text NOT NULL DEFAULT 'sent'
                CHECK (state IN ('sent','accepted','declined','expired','revoked')),
  holds_spot    boolean NOT NULL DEFAULT true,
  expires_at    timestamptz NOT NULL,

  created_at    timestamptz NOT NULL DEFAULT now(),
  responded_at  timestamptz,

  CONSTRAINT invitation_target CHECK (num_nonnulls(invitee_id, invitee_email) = 1),
  -- Una invitación por email necesita token; una in-app no.
  CONSTRAINT invitation_email_needs_token CHECK (
    invitee_email IS NULL OR token_hash IS NOT NULL
  ),
  CONSTRAINT invitation_no_self CHECK (invitee_id IS NULL OR invitee_id <> inviter_id)
);

-- Una invitación viva por persona y por turno. Índices parciales en vez de
-- UNIQUE simple: una invitación revocada no debe impedir volver a invitar.
CREATE UNIQUE INDEX invitations_one_live_per_profile
  ON public.match_invitations (offer_id, invitee_id)
  WHERE invitee_id IS NOT NULL AND state = 'sent';
CREATE UNIQUE INDEX invitations_one_live_per_email
  ON public.match_invitations (offer_id, invitee_email)
  WHERE invitee_email IS NOT NULL AND state = 'sent';

CREATE INDEX invitations_expiry_idx ON public.match_invitations (expires_at)
  WHERE state = 'sent';
CREATE INDEX invitations_invitee_idx ON public.match_invitations (invitee_id)
  WHERE invitee_id IS NOT NULL;

-- ---------------------------------------------------------------------------
--  Lista de supresión · regla 9
--
--  Quien pidió no recibir más, no recibe más — de nadie. Se consulta ANTES de
--  cualquier envío. Guarda el hash del email, no el email: es una lista de
--  gente que NO quiere saber nada de la app, sería absurdo conservarles la
--  dirección en claro.
-- ---------------------------------------------------------------------------
CREATE TABLE public.invite_suppressions (
  email_hash bytea PRIMARY KEY,
  reason     text NOT NULL CHECK (reason IN ('unsubscribed','reported','bounced')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===========================================================================
--  RLS
-- ===========================================================================
ALTER TABLE public.match_invitations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_invitations   FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.invite_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_suppressions FORCE  ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.match_invitations TO authenticated;
-- `invite_suppressions` NO se expone a ningún rol de la API: la escribe el
-- servidor con service_role desde el enlace de baja, que no requiere login.
-- Sin políticas y sin GRANT, para la API es una tabla que no existe.

-- Ve la invitación quien la mandó y quien la recibió. El email del invitado
-- solo lo ve quien invitó — que ya lo conocía, porque lo escribió.
CREATE POLICY invitations_select ON public.match_invitations
  FOR SELECT TO authenticated
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid());

-- Solo el creador del turno invita, solo a turnos suyos, y nunca a alguien
-- con quien haya un bloqueo de por medio.
CREATE POLICY invitations_insert ON public.match_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    inviter_id = auth.uid()
    AND app.owns_offer(offer_id)
    AND state = 'sent'
    AND expires_at > now()
    AND (invitee_id IS NULL OR NOT app.is_blocked_with(invitee_id))
  );

-- El que invitó puede revocar; el invitado puede aceptar o rechazar.
CREATE POLICY invitations_update ON public.match_invitations
  FOR UPDATE TO authenticated
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid())
  WITH CHECK (inviter_id = auth.uid() OR invitee_id = auth.uid());
